import type { PredictionDistribution } from './contracts.js';

export interface DistributionDisagreement {
  outcomes: readonly string[];
  totalVariation: number;
  euclideanDistance: number;
  manhattanDistance: number;
  maxAbsoluteDelta: number;
  meanAbsoluteDelta: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ProbabilityPerspective {
  perspectiveId: string;
  distribution: PredictionDistribution;
  confidence?: number;
}

function probabilityMap(distribution: PredictionDistribution): Map<string, number> {
  return new Map(distribution.outcomes.map((item) => [item.outcome, item.probability]));
}

function level(delta: number): DistributionDisagreement['level'] {
  if (delta >= 0.35) return 'CRITICAL';
  if (delta >= 0.20) return 'HIGH';
  if (delta >= 0.10) return 'MEDIUM';
  return 'LOW';
}

function assertDistribution(distribution: PredictionDistribution): void {
  if (distribution.outcomes.length === 0) throw new Error('Distribution must contain outcomes');
  const seen = new Set<string>();
  let total = 0;
  for (const item of distribution.outcomes) {
    if (!item.outcome.trim()) throw new Error('Distribution outcome is required');
    if (seen.has(item.outcome)) throw new Error(`Duplicate outcome ${item.outcome}`);
    if (!Number.isFinite(item.probability) || item.probability < 0 || item.probability > 1) {
      throw new Error(`Invalid probability for ${item.outcome}`);
    }
    seen.add(item.outcome);
    total += item.probability;
  }
  if (Math.abs(total - 1) > 1e-9) throw new Error(`Distribution probabilities must sum to 1, got ${total}`);
}

export function compareProbabilityDistributions(
  left: PredictionDistribution,
  right: PredictionDistribution,
): DistributionDisagreement {
  assertDistribution(left);
  assertDistribution(right);
  const leftMap = probabilityMap(left);
  const rightMap = probabilityMap(right);
  const outcomes = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
  const deltas = outcomes.map((outcome) => (leftMap.get(outcome) ?? 0) - (rightMap.get(outcome) ?? 0));
  const absolute = deltas.map(Math.abs);
  const totalVariation = 0.5 * absolute.reduce((sum, value) => sum + value, 0);
  const manhattanDistance = absolute.reduce((sum, value) => sum + value, 0);
  const euclideanDistance = Math.sqrt(deltas.reduce((sum, value) => sum + value * value, 0));
  const maxAbsoluteDelta = Math.max(...absolute);
  const meanAbsoluteDelta = absolute.reduce((sum, value) => sum + value, 0) / absolute.length;

  return Object.freeze({
    outcomes: Object.freeze(outcomes),
    totalVariation,
    euclideanDistance,
    manhattanDistance,
    maxAbsoluteDelta,
    meanAbsoluteDelta,
    level: level(maxAbsoluteDelta),
  });
}

export function averageProbabilityPerspective(
  perspectives: readonly ProbabilityPerspective[],
): PredictionDistribution {
  if (perspectives.length === 0) throw new Error('At least one probability perspective is required');
  perspectives.forEach((perspective) => assertDistribution(perspective.distribution));

  const outcomes = [...new Set(perspectives.flatMap((perspective) => perspective.distribution.outcomes.map((item) => item.outcome)))].sort();
  const maps = perspectives.map((perspective) => probabilityMap(perspective.distribution));
  const raw = outcomes.map((outcome) => ({
    outcome,
    probability: maps.reduce((sum, map) => sum + (map.get(outcome) ?? 0), 0) / maps.length,
  }));
  const total = raw.reduce((sum, item) => sum + item.probability, 0);
  const outcomesWithProbability = raw.map((item) => ({ outcome: item.outcome, probability: item.probability / total }));

  return Object.freeze({
    outcomes: Object.freeze(outcomesWithProbability),
    modelId: 'perspective-aggregate',
    modelVersion: 'v1',
  });
}

export function entropy(distribution: PredictionDistribution): number {
  assertDistribution(distribution);
  return -distribution.outcomes.reduce((sum, item) => {
    if (item.probability === 0) return sum;
    return sum + item.probability * Math.log(item.probability);
  }, 0);
}

export function expectedCalibrationGap(predictedProbability: number, empiricalProbability: number): number {
  if (![predictedProbability, empiricalProbability].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new Error('Calibration probabilities must be within [0,1]');
  }
  return Math.abs(predictedProbability - empiricalProbability);
}
