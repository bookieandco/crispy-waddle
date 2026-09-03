import type { RandomSource } from './simulation.js';
import type { NBAEvent, NBAEventGameState } from './nba-event-state-machine.js';
import { applyNBAEvent, createNBAEvent, resolveMissedShotRebound } from './nba-event-state-machine.js';
import type { NBAPossessionState } from './nba-possession.js';
import { resolveNBAPossession } from './nba-possession.js';
import type { NBALivePlayerState } from './nba-live-state.js';
import { applyNBALiveEvent } from './nba-live-event-bridge.js';

export interface NBAOrchestratedPossessionResult {
  initialState: NBAEventGameState;
  finalState: NBAEventGameState;
  events: readonly NBAEvent[];
  possession: ReturnType<typeof resolveNBAPossession>;
  livePlayers?: Readonly<Record<string, NBALivePlayerState>>;
}

export interface NBAReboundPolicy { offensive: number; defensive: number; }
export interface NBAFoulPolicy { shootingProbability: number; threePointProbability: number; }
export interface NBAOrchestratorOptions {
  reboundPolicy?: NBAReboundPolicy;
  foulPolicy?: NBAFoulPolicy;
  maxPassContinuations?: number;
  livePlayers?: Readonly<Record<string, NBALivePlayerState>>;
  asOf?: string;
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

function actionEvent(state: NBAEventGameState, possession: NBAPossessionState, action: ReturnType<typeof resolveNBAPossession>['action']): NBAEvent {
  const kind: NBAEvent['kind'] = action === 'SHOT_2' || action === 'SHOT_3' ? 'SHOT' : action;
  return createNBAEvent(state, kind, {
    teamId: possession.offenseTeamId,
    playerId: possession.ballHandler.playerId,
    opponentPlayerId: possession.primaryDefender.playerId,
    points: action === 'SHOT_3' ? 3 : action === 'SHOT_2' ? 2 : 0,
    elapsedSeconds: 1,
    evidenceIds: Object.freeze([...new Set([...possession.matchup.attacker.evidenceIds, ...possession.matchup.defender.evidenceIds, ...(possession.context?.evidenceIds ?? [])])].sort()),
  });
}

function applyEventWithOptionalLive(state: NBAEventGameState, players: Readonly<Record<string, NBALivePlayerState>> | undefined, event: NBAEvent, rng: RandomSource, asOf: string | undefined): { state: NBAEventGameState; players?: Readonly<Record<string, NBALivePlayerState>> } {
  if (!players || !asOf) return { state: applyNBAEvent(state, event) };
  const bridged = applyNBALiveEvent(state, players, event, rng, asOf);
  return { state: bridged.gameState, players: bridged.players };
}

export function resolveNBAOrchestratedPossession(
  state: NBAEventGameState,
  possession: NBAPossessionState,
  rng: RandomSource,
  options: NBAOrchestratorOptions = {},
): NBAOrchestratedPossessionResult {
  if (state.offenseTeamId !== possession.offenseTeamId) throw new Error('Possession offense team does not match game state');
  const reboundPolicy = options.reboundPolicy ?? { offensive: 0.25, defensive: 0.75 };
  const foulPolicy = options.foulPolicy ?? { shootingProbability: 0.65, threePointProbability: 0.08 };
  const maxPassContinuations = options.maxPassContinuations ?? 1;
  if (!Number.isInteger(maxPassContinuations) || maxPassContinuations < 0) throw new Error('maxPassContinuations must be a non-negative integer');

  const initialState = state;
  const events: NBAEvent[] = [];
  let current = state;
  let livePlayers = options.livePlayers;
  let resolved = resolveNBAPossession(possession, rng);
  let passCount = 0;

  const apply = (event: NBAEvent) => {
    const result = applyEventWithOptionalLive(current, livePlayers, event, rng, options.asOf);
    current = result.state;
    livePlayers = result.players;
    events.push(event);
  };

  apply(createNBAEvent(current, 'POSSESSION_START', {
    teamId: possession.offenseTeamId,
    playerId: possession.ballHandler.playerId,
    elapsedSeconds: 0,
    evidenceIds: possession.context?.evidenceIds ?? [],
  }));

  while (true) {
    if (resolved.action === 'PASS' && passCount < maxPassContinuations) {
      apply(actionEvent(current, possession, 'PASS'));
      passCount += 1;
      resolved = resolveNBAPossession({ ...possession, possessionId: `${possession.possessionId}:pass${passCount}`, clockSeconds: Math.max(1, current.periodSecondsRemaining), shotClockSeconds: Math.max(1, current.shotClockSeconds) }, rng);
      continue;
    }

    if (resolved.action === 'FOUL') {
      const shooting = rng.next() < clamp(foulPolicy.shootingProbability);
      const threePoint = shooting && rng.next() < clamp(foulPolicy.threePointProbability);
      const foul = Object.freeze({ ...actionEvent(current, possession, 'FOUL'), foulKind: shooting ? 'SHOOTING' : 'NON_SHOOTING', freeThrows: shooting ? (threePoint ? 3 : 2) : 0 });
      apply(foul);
      if (shooting) {
        for (let attempt = 1; attempt <= (foul.freeThrows ?? 0); attempt += 1) {
          const made = rng.next() < 0.75;
          apply(createNBAEvent(current, 'FREE_THROW', {
            teamId: possession.offenseTeamId,
            playerId: possession.ballHandler.playerId,
            made,
            points: made ? 1 : 0,
            freeThrows: 1,
            elapsedSeconds: 0,
            evidenceIds: foul.evidenceIds,
          }));
          if (!made && attempt === (foul.freeThrows ?? 0)) {
            const rebound = resolveMissedShotRebound(current, rng, reboundPolicy.offensive, reboundPolicy.defensive, foul.evidenceIds);
            apply(rebound);
          }
        }
        if (current.offenseTeamId === possession.offenseTeamId && events.at(-1)?.kind === 'FREE_THROW' && events.at(-1)?.made) {
          current = Object.freeze({ ...current, offenseTeamId: possession.defenseTeamId, defenseTeamId: possession.offenseTeamId, shotClockSeconds: 24 });
        }
      }
      break;
    }

    const event = actionEvent(current, possession, resolved.action);
    if (resolved.action === 'SHOT_2' || resolved.action === 'SHOT_3') {
      const shot = Object.freeze({ ...event, made: resolved.madeShot, points: resolved.madeShot ? resolved.points : 0 });
      apply(shot);
      if (!resolved.madeShot) {
        const rebound = resolveMissedShotRebound(current, rng, reboundPolicy.offensive, reboundPolicy.defensive, resolved.evidenceIds);
        apply(rebound);
      }
      break;
    }

    apply(event);
    if (resolved.action === 'TURNOVER') break;
    break;
  }

  apply(createNBAEvent(current, 'POSSESSION_END', {
    teamId: current.offenseTeamId,
    elapsedSeconds: 0,
    evidenceIds: possession.context?.evidenceIds ?? [],
  }));

  return Object.freeze({ initialState, finalState: current, events: Object.freeze(events), possession: resolved, ...(livePlayers ? { livePlayers } : {}) });
}
