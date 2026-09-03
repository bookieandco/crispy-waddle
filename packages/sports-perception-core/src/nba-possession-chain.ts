import type { NBALineupState } from './nba-lineup-state.js';
import type { NBAPossessionState, NBAPossessionResult } from './nba-possession.js';
import type { RandomSource } from './simulation.js';
import { resolveNBAPossession } from './nba-possession.js';

export interface NBAReboundState {
  offensiveReboundProbability: number;
  defensiveReboundProbability: number;
  shotWasMissed: boolean;
}

export interface NBAPossessionChainState {
  possession: NBAPossessionState;
  offenseLineup: NBALineupState;
  defenseLineup: NBALineupState;
  rebound?: NBAReboundState;
}

export interface NBAPossessionChainResult {
  possession: NBAPossessionResult;
  rebound: 'OFFENSIVE' | 'DEFENSIVE' | 'NONE';
  nextTeamId: string;
  nextShotClockSeconds: number;
  evidenceIds: readonly string[];
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function resolveNBAPossessionChain(
  state: NBAPossessionChainState,
  rng: RandomSource,
): NBAPossessionChainResult {
  const possession = resolveNBAPossession(state.possession, rng);
  const missed = possession.points === 0 && possession.action !== 'TURNOVER' && possession.action !== 'FOUL';

  let rebound: NBAPossessionChainResult['rebound'] = 'NONE';
  let nextTeamId = possession.nextOffenseTeamId;
  let nextShotClockSeconds = 24;

  if (missed && state.rebound?.shotWasMissed) {
    const offensive = clamp(state.rebound.offensiveReboundProbability);
    const defensive = clamp(state.rebound.defensiveReboundProbability);
    const total = offensive + defensive;
    const offensiveProbability = total > 0 ? offensive / total : 0;
    if (rng.next() < offensiveProbability) {
      rebound = 'OFFENSIVE';
      nextTeamId = state.possession.offenseTeamId;
      nextShotClockSeconds = 14;
    } else {
      rebound = 'DEFENSIVE';
      nextTeamId = state.possession.defenseTeamId;
      nextShotClockSeconds = 24;
    }
  }

  const evidenceIds = Object.freeze([...new Set([
    ...state.possession.matchup.attacker.evidenceIds,
    ...state.possession.matchup.defender.evidenceIds,
    ...state.possession.matchup.attacker.evidenceIds,
    ...state.possession.matchup.defender.evidenceIds,
    ...state.possession.evidenceIds,
  ])].sort());

  return Object.freeze({
    possession,
    rebound,
    nextTeamId,
    nextShotClockSeconds,
    evidenceIds,
  });
}
