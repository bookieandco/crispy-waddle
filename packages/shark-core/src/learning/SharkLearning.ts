import type { OutcomeLabel } from '../outcomes/SharkOutcome';

export interface FeatureStats {
  readonly feature: string;
  readonly samples: number;
  readonly wins: number;
  readonly losses: number;
  readonly rugs: number;
  readonly meanReturnPct?: number;
  readonly winRate: number;
  readonly rugRate: number;
}

export interface PatternStats {
  readonly patternId: string;
  readonly samples: number;
  readonly outcomes: Readonly<Record<OutcomeLabel, number>>;
  readonly conditionalWinRate: number;
  readonly conditionalRugRate: number;
  readonly confidence: number;
}

/**
 * Statistics only. Updating these records does not change execution authority.
 */
export interface SharkLearningState {
  readonly version: string;
  readonly sampleCount: number;
  readonly featureStats: readonly FeatureStats[];
  readonly patternStats: readonly PatternStats[];
  readonly lastUpdatedAt: string;
}

export function smoothedRate(successes: number, trials: number, prior = 0.5): number {
  if (trials < 0 || successes < 0 || successes > trials) {
    throw new Error('Invalid binomial counts');
  }
  // Laplace smoothing prevents one lucky early trade from becoming "street law".
  return (successes + prior) / (trials + 2 * prior);
}
