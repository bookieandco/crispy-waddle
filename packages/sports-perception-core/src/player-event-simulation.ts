import type { PlayerSimulationMatchup } from './player-simulation.js';

export interface PlayerEventContest {
  eventId: string;
  outcome: string;
  attribute: string;
  baseProbability: number;
  matchup: PlayerSimulationMatchup;
  scenarioAdjustment?: number;
}

export interface ResolvedPlayerEventContest {
  eventId: string;
  outcome: string;
  attribute: string;
  baseProbability: number;
  matchupAdjustment: number;
  resolvedProbability: number;
  uncertainty: number;
  evidenceIds: readonly string[];
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

export function resolvePlayerEventContest(contest: PlayerEventContest): ResolvedPlayerEventContest {
  if (!contest.eventId.trim()) throw new Error('Player event ID is required');
  if (!contest.outcome.trim()) throw new Error('Player event outcome is required');
  if (!contest.attribute.trim()) throw new Error('Player event attribute is required');
  if (!Number.isFinite(contest.baseProbability) || contest.baseProbability < 0 || contest.baseProbability > 1) {
    throw new Error('Player event base probability must be within [0,1]');
  }

  const rawAdjustment = contest.matchup.attributeAdjustments[contest.attribute] ?? 0;
  const normalizedAdjustment = rawAdjustment / 100;
  const scenarioAdjustment = contest.scenarioAdjustment ?? 0;
  const matchupAdjustment = normalizedAdjustment + scenarioAdjustment;

  const odds = contest.baseProbability / Math.max(1e-9, 1 - contest.baseProbability);
  const adjustedOdds = odds * Math.exp(matchupAdjustment);
  const resolvedProbability = clamp(adjustedOdds / (1 + adjustedOdds));
  const evidenceIds = Object.freeze([
    ...new Set([...contest.matchup.attacker.evidenceIds, ...contest.matchup.defender.evidenceIds]),
  ].sort());

  return Object.freeze({
    eventId: contest.eventId,
    outcome: contest.outcome,
    attribute: contest.attribute,
    baseProbability: contest.baseProbability,
    matchupAdjustment,
    resolvedProbability,
    uncertainty: contest.matchup.combinedUncertainty,
    evidenceIds,
  });
}
