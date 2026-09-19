import type { PredictionDistribution } from './contracts.js';

export interface SensitivityParameter {
  parameterId: string;
  baseline: number;
  lower: number;
  upper: number;
}

export interface SensitivityObservation {
  parameterId: string;
  baselineOutcome: string;
  lowerOutcomeProbability: number;
  baselineOutcomeProbability: number;
  upperOutcomeProbability: number;
  lowerDelta: number;
  upperDelta: number;
  maxAbsoluteEffect: number;
  direction: 'INCREASES' | 'DECREASES' | 'MIXED' | 'NEUTRAL';
}

export interface SensitivityEvaluator {
  evaluate(parameter: SensitivityParameter, value: number): PredictionDistribution;
}

function probabilityOf(distribution: PredictionDistribution, outcome: string): number {
  return distribution.outcomes.find((item) => item.outcome === outcome)?.probability ?? 0;
}

function validateParameter(parameter: SensitivityParameter): void {
  if (!parameter.parameterId.trim()) throw new Error('Sensitivity parameter ID is required');
  if (![parameter.baseline, parameter.lower, parameter.upper].every(Number.isFinite)) throw new Error('Sensitivity bounds must be finite');
  if (parameter.lower > parameter.baseline || parameter.baseline > parameter.upper) throw new Error('Sensitivity bounds must satisfy lower <= baseline <= upper');
}

function validateDistribution(distribution: PredictionDistribution): void {
  if (distribution.outcomes.length === 0) throw new Error('Sensitivity evaluator returned an empty distribution');
  const total = distribution.outcomes.reduce((sum, item) => sum + item.probability, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error(`Sensitivity distribution must sum to 1, got ${total}`);
}

export function analyzeSensitivity(
  parameters: readonly SensitivityParameter[],
  evaluator: SensitivityEvaluator,
  baselineOutcome?: string,
): readonly SensitivityObservation[] {
  if (parameters.length === 0) return Object.freeze([]);
  const results: SensitivityObservation[] = [];

  for (const parameter of parameters) {
    validateParameter(parameter);
    const baseline = evaluator.evaluate(parameter, parameter.baseline);
    const lower = evaluator.evaluate(parameter, parameter.lower);
    const upper = evaluator.evaluate(parameter, parameter.upper);
    validateDistribution(baseline);
    validateDistribution(lower);
    validateDistribution(upper);

    const outcome = baselineOutcome ?? [...baseline.outcomes].sort((a, b) => b.probability - a.probability || a.outcome.localeCompare(b.outcome))[0].outcome;
    const baselineProbability = probabilityOf(baseline, outcome);
    const lowerProbability = probabilityOf(lower, outcome);
    const upperProbability = probabilityOf(upper, outcome);
    const lowerDelta = lowerProbability - baselineProbability;
    const upperDelta = upperProbability - baselineProbability;
    const maxAbsoluteEffect = Math.max(Math.abs(lowerDelta), Math.abs(upperDelta));

    let direction: SensitivityObservation['direction'] = 'NEUTRAL';
    if (Math.abs(lowerDelta) > 1e-12 && Math.abs(upperDelta) > 1e-12) {
      direction = Math.sign(lowerDelta) === Math.sign(upperDelta)
        ? (upperDelta > 0 ? 'INCREASES' : 'DECREASES')
        : 'MIXED';
    } else if (Math.abs(lowerDelta) > 1e-12 || Math.abs(upperDelta) > 1e-12) {
      direction = (lowerDelta + upperDelta) > 0 ? 'INCREASES' : 'DECREASES';
    }

    results.push(Object.freeze({
      parameterId: parameter.parameterId,
      baselineOutcome: outcome,
      lowerOutcomeProbability: lowerProbability,
      baselineOutcomeProbability: baselineProbability,
      upperOutcomeProbability: upperProbability,
      lowerDelta,
      upperDelta,
      maxAbsoluteEffect,
      direction,
    }));
  }

  return Object.freeze(results.sort((a, b) => b.maxAbsoluteEffect - a.maxAbsoluteEffect || a.parameterId.localeCompare(b.parameterId)));
}
