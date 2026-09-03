import type { RandomSource } from './simulation.js';
import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { createNBAEvent } from './nba-event-state-machine.js';
import type { NBAPossessionState } from './nba-possession.js';
import { resolveNBAOrchestratedPossession } from './nba-possession-orchestrator.js';
import type { NBALivePlayerState } from './nba-live-state.js';
import { resolveNBARotationFeedback } from './nba-rotation-feedback.js';
import type { NBACanonicalEventLedger } from './nba-canonical-ledger.js';
import { NBAEventLedger, hashNBAState } from './nba-canonical-ledger.js';

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
  ledger: NBACanonicalEventLedger;
  livePlayers?: Readonly<Record<string, NBALivePlayerState>>;
  rotations: number;
  possessions: number;
}

const MAX_POSSESSIONS = 2_000;

export function runNBAGameLoop(input: NBAGameLoopInput): NBAGameLoopResult {
  const maxPossessions = input.maxPossessions ?? MAX_POSSESSIONS;
  if (!Number.isInteger(maxPossessions) || maxPossessions < 0) throw new Error('maxPossessions must be a non-negative integer');

  const initialState = input.state;
  const ledger = new NBAEventLedger(initialState);
  let livePlayers = input.livePlayers;
  let rotations = 0;
  let possessions = 0;

  while (possessions < maxPossessions && ledger.snapshot().finalState.periodSecondsRemaining > 0) {
    const state = ledger.snapshot().finalState;
    const possession = input.possessionFactory(state);
    const result = resolveNBAOrchestratedPossession(state, possession, input.rng, {
      livePlayers,
      asOf: input.asOf,
    });

    for (const event of result.events) ledger.append(event);

    const afterPossession = ledger.snapshot().finalState;
    if (hashNBAState(afterPossession) !== hashNBAState(result.finalState)) {
      throw new Error('NBA possession result diverges from canonical ledger state');
    }
    livePlayers = result.livePlayers;

    if (afterPossession.offenseLineup || afterPossession.defenseLineup) {
      const feedback = resolveNBARotationFeedback(afterPossession, livePlayers ?? {}, undefined);
      if (feedback.decisions.length > 0) {
        livePlayers = feedback.players;
        for (const decision of feedback.decisions) {
          const current = ledger.snapshot().finalState;
          const teamId = decision.playerOut
            ? (current.players[decision.playerOut]?.teamId ?? current.offenseTeamId)
            : current.offenseTeamId;
          const substitution = createNBAEvent(current, 'SUBSTITUTION', {
            teamId,
            playerId: decision.playerIn,
            opponentPlayerId: decision.playerOut,
            elapsedSeconds: 0,
            evidenceIds: current.evidenceIds,
          });
          ledger.append(substitution);
          rotations += 1;
        }
      }
    }

    possessions += 1;
    if (ledger.snapshot().finalState.periodSecondsRemaining <= 0) break;
  }

  const snapshot = ledger.snapshot();
  return Object.freeze({
    initialState,
    finalState: snapshot.finalState,
    events: Object.freeze(snapshot.transitions.map((transition) => transition.event)),
    ledger: snapshot,
    ...(livePlayers ? { livePlayers } : {}),
    rotations,
    possessions,
  });
}
