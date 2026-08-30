import type { LearningOutcome } from './contracts.js';

export interface FeatureStats {
  samples: number;
  wins: number;
  losses: number;
  meanReturnPct: number;
  meanDrawdownPct: number;
  winRate: number;
  avoidedLosses: number;
  missedWins: number;
}

export interface SharkLearningModel {
  version: number;
  updatedAt: string;
  byFeatureBand: Record<string, FeatureStats>;
}

const empty = (): FeatureStats => ({
  samples: 0,
  wins: 0,
  losses: 0,
  meanReturnPct: 0,
  meanDrawdownPct: 0,
  winRate: 0,
  avoidedLosses: 0,
  missedWins: 0,
});

function band(value: number): string {
  if (value < 20) return '0-19';
  if (value < 40) return '20-39';
  if (value < 60) return '40-59';
  if (value < 80) return '60-79';
  return '80-100';
}

/**
 * Learns from realized outcomes without letting a single trade rewrite policy.
 * The result is a statistical prior that can later adjust scoring weights.
 */
export function updateLearningModel(model: SharkLearningModel, outcome: LearningOutcome): SharkLearningModel {
  const next: SharkLearningModel = structuredClone(model);
  const key = `score:${band(outcome.featureSnapshot.score ?? 0)}|rug:${band(outcome.featureSnapshot.rugRisk ?? 0)}`;
  const stats = next.byFeatureBand[key] ?? empty();
  const n = stats.samples;

  stats.samples += 1;
  if (outcome.outcome === 'win') stats.wins += 1;
  if (outcome.outcome === 'loss') stats.losses += 1;
  if (outcome.outcome === 'avoided-loss') stats.avoidedLosses += 1;
  if (outcome.outcome === 'missed-win') stats.missedWins += 1;
  if (outcome.returnPct != null) stats.meanReturnPct = (stats.meanReturnPct * n + outcome.returnPct) / (n + 1);
  if (outcome.maxDrawdownPct != null) stats.meanDrawdownPct = (stats.meanDrawdownPct * n + outcome.maxDrawdownPct) / (n + 1);
  stats.winRate = stats.samples ? stats.wins / stats.samples : 0;

  next.byFeatureBand[key] = stats;
  next.version += 1;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function learningAdjustment(model: SharkLearningModel, score: number, rugRisk: number): number {
  const stats = model.byFeatureBand[`score:${band(score)}|rug:${band(rugRisk)}`];
  if (!stats || stats.samples < 10) return 0;

  // Small bounded adjustment. Learning changes confidence, not the hard stops.
  const expectancy = stats.meanReturnPct / 10;
  const reliability = Math.min(1, stats.samples / 100);
  return Math.max(-10, Math.min(10, expectancy * reliability));
}
