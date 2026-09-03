import type { RandomSource } from './simulation.js';
import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAEvent } from './nba-event-state-machine.js';
import type { NBAPossessionState } from './nba-possession.js';
import { resolveNBAOrchestratedPossession } from './nba-possession-orchestrator.js';
import type { NBALivePlayerState } from './nba-live-state.js';
import { resolveNBARotationFeedback } from './nba-rotation-feedback.js';

export interface NBAGameLoopInput {
  state: NBAEventGameState;
  possessionFactory: (state: NBAEventGameState) => NBAPossessionState;
  rng: RandomSource;
  maxPossessions?: number;
  livePlayers?: Readonly<Record<string, NBALivePlayerState>>;
  asOf?: string;
}

export interface NBAGameLoopResult {
  initialState: NBAEventGameState;
  finalState: NBAEventGameState;
  events: readonly NBAEvent[];
  livePlayers?: Readonly<Record<string, NBALivePlayerState>>;
  rotations: number;
  possessions: number;
}

const MAX_POSSESSIONS = 2_000;

export function runNBAGameLoop(input: NBAGameLoopInput): NBAGameLoopResult {
  const maxPossessions = input.maxPossessions ?? MAX_POSSESSIONS;
  if (!Number.isInteger(maxPossessions) || maxPossessions < 0) throw new Error('maxPossessions must be a non-negative integer');

  const initialState = input.state;
  let state = input.state;
  let livePlayers = input.livePlayers;
  const events: NBAEvent[] = [];
  let rotations = 0;
  let possessions = 0;

  while (possessions < maxPossessions && state.periodSecondsRemaining > 0) {
    const possession = input.possessionFactory(state);
    const result = resolveNBAOrchestratedPossession(state, possession, input.rng, {
      livePlayers,
      asOf: input.asOf,
    });
    state = result.finalState;
    livePlayers = result.livePlayers;
    events.push(...result.events);

    if (state.offenseLineup || state.defenseLineup) {
      const feedback = resolveNBARotationFeedback(state, livePlayers ?? {}, undefined);
      if (feedback.decisions.length > 0) {
        state = Object.freeze({
          ...state,
          offenseLineup: feedback.offenseLineup,
          defenseLineup: feedback.defenseLineup,
        });
        livePlayers = feedback.players;
        for (const decision of feedback.decisions) {
          const teamId = decision.playerOut
            ? (state.players[decision.playerOut]?.teamId ?? state.offenseTeamId)
            : state.offenseTeamId;
          const substitution = createNBAEvent(state, 'SUBSTITUTION', {
            teamId,
            playerId: decision.playerIn,
            opponentPlayerId: decision.playerOut,
            elapsedSeconds: 0,
            evidenceIds: state.evidenceIds,
          });
          events.push(substitution);
          state = Object.freeze({
            ...state,
            sequence: substitution.sequence,
            lastEventId: substitution.eventId,
            evidenceIds: Object.freeze([...new Set([...state.evidenceIds, ...substitution.evidenceIds])].sort()),
          });
          rotations += 1;
        }
      }
    }

    possessions += 1;
    if (state.periodSecondsRemaining <= 0) break;
  }

  return Object.freeze({
    initialState,
    finalState: state,
    events: Object.freeze(events),
    ...(livePlayers ? { livePlayers } : {}),
    rotations,
    possessions,
  });
}
