import type { GrowthId } from '../domain/types.js';
import type { PatternHypothesis } from './social-pattern-transfer.js';

export type PatternExperimentMetric = 'qualified_leads' | 'conversions' | 'conversation_rate';

export interface PatternExperiment {
  readonly id: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly strategy: string;
  readonly controlRequired: true;
  readonly treatmentRequired: true;
  readonly successMetric: PatternExperimentMetric;
  readonly minimumObservations: number;
  readonly status: 'planned';
}

/**
 * Raw observations are intentionally not allowed to supply winner/promoted state
 * or experiment identity bindings. Those are derived by evaluatePatternExperiment.
 */
export interface PatternExperimentObservation {
  readonly controlMetric: number;
  readonly treatmentMetric: number;
  readonly controlObservations: number;
  readonly treatmentObservations: number;
  readonly evaluatedAt: string;
  /** Stable identifier for the upstream experiment execution/evidence batch. */
  readonly evaluationId: GrowthId;
}

/**
 * Evaluated result. All experiment identity/population bindings are copied from
 * the immutable experiment, so promotion cannot be driven by caller-supplied
 * account/audience/voice/metric provenance.
 */
export interface PatternExperimentResult {
  readonly evaluationId: GrowthId;
  readonly experimentId: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly successMetric: PatternExperimentMetric;
  readonly controlMetric: number;
  readonly treatmentMetric: number;
  readonly controlObservations: number;
  readonly treatmentObservations: number;
  readonly observations: number;
  readonly minimumObservations: number;
  readonly winner: 'control' | 'treatment' | 'inconclusive';
  readonly promoted: boolean;
  readonly reason: string;
  readonly evaluatedAt: string;
  readonly evaluationSource: 'pattern-experiment-evaluator';
}

export function planPatternExperiment(
  hypothesis: PatternHypothesis,
  successMetric: PatternExperimentMetric = 'qualified_leads',
  minimumObservations = 30,
): PatternExperiment {
  return {
    id: `pattern-experiment:${hypothesis.id}` as GrowthId,
    hypothesisId: hypothesis.id,
    targetAccountId: hypothesis.targetAccountId,
    targetAudienceId: hypothesis.targetAudienceId,
    targetVoiceId: hypothesis.targetVoiceId,
    strategy: hypothesis.strategy,
    controlRequired: true,
    treatmentRequired: true,
    successMetric,
    minimumObservations: Math.max(10, minimumObservations),
    status: 'planned',
  };
}

const clampMetric = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const normalizeObservations = (value: number): number => Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);

export function evaluatePatternExperiment(
  experiment: PatternExperiment,
  observation: PatternExperimentObservation,
): PatternExperimentResult {
  const controlObservations = normalizeObservations(observation.controlObservations);
  const treatmentObservations = normalizeObservations(observation.treatmentObservations);
  const observations = controlObservations + treatmentObservations;
  const base = {
    evaluationId: observation.evaluationId,
    experimentId: experiment.id,
    hypothesisId: experiment.hypothesisId,
    targetAccountId: experiment.targetAccountId,
    targetAudienceId: experiment.targetAudienceId,
    targetVoiceId: experiment.targetVoiceId,
    successMetric: experiment.successMetric,
    controlMetric: clampMetric(observation.controlMetric),
    treatmentMetric: clampMetric(observation.treatmentMetric),
    controlObservations,
    treatmentObservations,
    observations,
    minimumObservations: experiment.minimumObservations,
    evaluatedAt: observation.evaluatedAt,
    evaluationSource: 'pattern-experiment-evaluator' as const,
  };

  if (!observation.evaluationId) {
    return { ...base, winner: 'inconclusive', promoted: false, reason: 'missing_evaluation_id' };
  }
  if (!observation.evaluatedAt || Number.isNaN(Date.parse(observation.evaluatedAt))) {
    return { ...base, winner: 'inconclusive', promoted: false, reason: 'invalid_evaluation_timestamp' };
  }
  if (controlObservations === 0 || treatmentObservations === 0) {
    return { ...base, winner: 'inconclusive', promoted: false, reason: 'missing_control_or_treatment_population' };
  }
  if (observations < experiment.minimumObservations) {
    return { ...base, winner: 'inconclusive', promoted: false, reason: 'insufficient_observations' };
  }

  const delta = base.treatmentMetric - base.controlMetric;
  const relative = base.controlMetric > 0 ? delta / base.controlMetric : delta;
  if (relative >= 0.1) {
    return { ...base, winner: 'treatment', promoted: true, reason: 'treatment_exceeded_control_by_at_least_10_percent' };
  }
  if (relative <= -0.1) {
    return { ...base, winner: 'control', promoted: false, reason: 'treatment_underperformed_control_by_at_least_10_percent' };
  }
  return { ...base, winner: 'inconclusive', promoted: false, reason: 'difference_within_10_percent' };
}
