import type { LearningSample, OutcomeLabel, SharkOutcome } from '../outcomes/SharkOutcome';
import { smoothedRate, type FeatureStats, type PatternStats } from './SharkLearning';

export interface PatternMatch {
  readonly patternId: string;
  readonly samples: number;
  readonly winRate: number;
  readonly rugRate: number;
  readonly confidence: number;
}

export interface PatternEngineReport {
  readonly sampleCount: number;
  readonly featureStats: readonly FeatureStats[];
  readonly patternStats: readonly PatternStats[];
}

export interface PatternEngineOptions {
  /** Minimum samples before a feature/pattern is treated as meaningful. */
  readonly minSamples?: number;
  /** Feature values within this tolerance are considered the same bucket. */
  readonly bucketSize?: number;
}

const OUTCOME_LABELS: readonly OutcomeLabel[] = [
  'win', 'loss', 'flat', 'rug', 'missed', 'unknown'
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function bucket(value: number, size: number): string {
  if (!Number.isFinite(value)) return 'na';
  const lower = Math.floor(value / size) * size;
  return `${lower.toFixed(3)}:${(lower + size).toFixed(3)}`;
}

function featureName(name: string, value: number, size: number): string {
  return `${name}=${bucket(value, size)}`;
}

function outcomeCounts(samples: readonly LearningSample[]): Record<OutcomeLabel, number> {
  const counts: Record<OutcomeLabel, number> = {
    win: 0, loss: 0, flat: 0, rug: 0, missed: 0, unknown: 0
  };
  for (const sample of samples) counts[sample.outcome.label] += 1;
  return counts;
}

function confidence(samples: number, minSamples: number): number {
  // Confidence grows with evidence, but never reaches certainty from sample count alone.
  return clamp01(1 - Math.exp(-samples / Math.max(1, minSamples * 2)));
}

/**
 * Deterministic statistics over immutable historical learning samples.
 *
 * This engine describes what happened; it does not authorize or execute trades.
 * No feature is allowed to learn from an outcome until that outcome is resolved.
 */
export class SharkPatternEngine {
  private readonly minSamples: number;
  private readonly bucketSize: number;

  public constructor(options: PatternEngineOptions = {}) {
    this.minSamples = Math.max(1, options.minSamples ?? 5);
    this.bucketSize = Math.max(0.0001, options.bucketSize ?? 0.1);
  }

  public analyze(samples: readonly LearningSample[]): PatternEngineReport {
    const featureBuckets = new Map<string, LearningSample[]>();
    const patternBuckets = new Map<string, LearningSample[]>();

    for (const sample of samples) {
      const featureEntries = Object.entries(sample.featureVector)
        .filter(([, value]) => Number.isFinite(value));

      for (const [name, value] of featureEntries) {
        const key = featureName(name, value, this.bucketSize);
        const bucketSamples = featureBuckets.get(key) ?? [];
        bucketSamples.push(sample);
        featureBuckets.set(key, bucketSamples);
      }

      // A pattern is the sorted combination of all available feature buckets.
      // Sorting makes the identifier order-independent and deterministic.
      const patternId = featureEntries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => featureName(name, value, this.bucketSize))
        .join('|');

      if (patternId) {
        const bucketSamples = patternBuckets.get(patternId) ?? [];
        bucketSamples.push(sample);
        patternBuckets.set(patternId, bucketSamples);
      }
    }

    const featureStats = [...featureBuckets.entries()]
      .filter(([, group]) => group.length >= this.minSamples)
      .map(([feature, group]) => this.toFeatureStats(feature, group))
      .sort((a, b) => b.samples - a.samples || a.feature.localeCompare(b.feature));

    const patternStats = [...patternBuckets.entries()]
      .filter(([, group]) => group.length >= this.minSamples)
      .map(([patternId, group]) => this.toPatternStats(patternId, group))
      .sort((a, b) => b.samples - a.samples || a.patternId.localeCompare(b.patternId));

    return { sampleCount: samples.length, featureStats, patternStats };
  }

  public match(featureVector: Readonly<Record<string, number>>, report: PatternEngineReport): readonly PatternMatch[] {
    const requested = Object.entries(featureVector)
      .filter(([, value]) => Number.isFinite(value));

    if (!requested.length) return [];

    const exactPatternId = requested
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => featureName(name, value, this.bucketSize))
      .join('|');

    const exact = report.patternStats.find((pattern) => pattern.patternId === exactPatternId);
    if (exact) {
      return [{
        patternId: exact.patternId,
        samples: exact.samples,
        winRate: exact.conditionalWinRate,
        rugRate: exact.conditionalRugRate,
        confidence: exact.confidence
      }];
    }

    // Fall back to independently observed feature patterns rather than inventing a match.
    const matches = report.featureStats.filter((stat) =>
      requested.some(([name, value]) => stat.feature === featureName(name, value, this.bucketSize))
    );

    return matches.map((stat) => ({
      patternId: stat.feature,
      samples: stat.samples,
      winRate: stat.winRate,
      rugRate: stat.rugRate,
      confidence: confidence(stat.samples, this.minSamples)
    }));
  }

  private toFeatureStats(feature: string, group: readonly LearningSample[]): FeatureStats {
    const wins = group.filter((sample) => sample.outcome.label === 'win').length;
    const losses = group.filter((sample) => sample.outcome.label === 'loss').length;
    const rugs = group.filter((sample) => sample.outcome.label === 'rug').length;
    const returns = group
      .map((sample) => sample.outcome.returnPct)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    return {
      feature,
      samples: group.length,
      wins,
      losses,
      rugs,
      meanReturnPct: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : undefined,
      winRate: smoothedRate(wins, group.length),
      rugRate: smoothedRate(rugs, group.length)
    };
  }

  private toPatternStats(patternId: string, group: readonly LearningSample[]): PatternStats {
    const outcomes = outcomeCounts(group);
    const actionableTrials = outcomes.win + outcomes.loss + outcomes.rug;

    return {
      patternId,
      samples: group.length,
      outcomes,
      conditionalWinRate: smoothedRate(outcomes.win, actionableTrials || group.length),
      conditionalRugRate: smoothedRate(outcomes.rug, actionableTrials || group.length),
      confidence: confidence(group.length, this.minSamples)
    };
  }
}

/** Build a learning sample only from a resolved outcome. */
export function resolvedLearningSample(
  decisionId: string,
  outcome: SharkOutcome,
  featureVector: Readonly<Record<string, number>>
): LearningSample {
  if (outcome.decisionId !== decisionId) {
    throw new Error('Outcome decisionId must match learning sample decisionId');
  }
  return { decisionId, outcome, featureVector };
}
