import type { GrowthId } from '../domain/types.js';
import type { PatternHypothesis } from './social-pattern-transfer.js';

export interface PatternExperiment {
  readonly id: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly strategy: string;
  readonly controlRequired: true;
  readonly treatmentRequired: true;
  readonly successMetric: 'qualified_leads' | 'conversions' | 'conversation_rate';
  readonly minimumObservations: number;
  readonly status: 'planned';
}

export interface PatternExperimentResult {
  readonly experimentId: GrowthId;
  readonly controlMetric: number;
  readonly treatmentMetric: number;
  readonly observations: number;
  readonly winner: 'control' | 'treatment' | 'inconclusive';
  readonly promoted: boolean;
  readonly reason: string;
}

export function planPatternExperiment(hypothesis: PatternHypothesis, successMetric: PatternExperiment['successMetric'] = 'qualified_leads', minimumObservations = 30): PatternExperiment {
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

export function evaluatePatternExperiment(result: Omit<PatternExperimentResult, 'winner' | 'promoted' | 'reason'>): PatternExperimentResult {
  if (result.observations < 30) return { ...result, winner: 'inconclusive', promoted: false, reason: 'insufficient_observations' };
  const delta = result.treatmentMetric - result.controlMetric;
  const relative = result.controlMetric > 0 ? delta / result.controlMetric : delta;
  if (relative >= 0.1) return { ...result, winner: 'treatment', promoted: true, reason: 'treatment_exceeded_control_by_at_least_10_percent' };
  if (relative <= -0.1) return { ...result, winner: 'control', promoted: false, reason: 'treatment_underperformed_control_by_at_least_10_percent' };
  return { ...result, winner: 'inconclusive', promoted: false, reason: 'difference_within_10_percent' };
}
