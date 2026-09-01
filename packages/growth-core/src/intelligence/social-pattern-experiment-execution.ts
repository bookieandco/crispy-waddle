import type { GrowthId } from '../domain/types.js';
import type { PatternExperiment, PatternExperimentResult } from './social-pattern-experiment.js';
import {
  bindExperimentEvidence,
  type PatternExperimentEvidence,
  type PatternExperimentEvidenceStore,
} from './social-pattern-experiment-evidence.js';

export interface PatternExperimentExecutionReport {
  readonly executionId: GrowthId;
  readonly experimentId: GrowthId;
  readonly hypothesisId: GrowthId;
  readonly targetAccountId: GrowthId;
  readonly targetAudienceId: GrowthId;
  readonly targetVoiceId: GrowthId;
  readonly successMetric: PatternExperiment['successMetric'];
  readonly controlMetric: number;
  readonly treatmentMetric: number;
  readonly controlObservations: number;
  readonly treatmentObservations: number;
  readonly observedAt: string;
}

export interface PatternExperimentExecutionAdapter {
  record(report: PatternExperimentExecutionReport): Promise<PatternExperimentEvidence>;
}

const isFiniteNonNegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
const isRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * Converts a trusted execution report into immutable evaluation evidence.
 * The adapter refuses malformed reports before they reach the evidence store.
 */
export function toPatternExperimentEvidence(
  experiment: PatternExperiment,
  report: PatternExperimentExecutionReport,
): PatternExperimentEvidence | null {
  if (report.executionId.length === 0) return null;
  if (report.experimentId !== experiment.id) return null;
  if (report.hypothesisId !== experiment.hypothesisId) return null;
  if (report.targetAccountId !== experiment.targetAccountId) return null;
  if (report.targetAudienceId !== experiment.targetAudienceId) return null;
  if (report.targetVoiceId !== experiment.targetVoiceId) return null;
  if (report.successMetric !== experiment.successMetric) return null;
  if (!isRate(report.controlMetric) || !isRate(report.treatmentMetric)) return null;
  if (!isFiniteNonNegative(report.controlObservations) || !isFiniteNonNegative(report.treatmentObservations)) return null;
  if (!Number.isInteger(report.controlObservations) || !Number.isInteger(report.treatmentObservations)) return null;
  if (report.controlObservations <= 0 || report.treatmentObservations <= 0) return null;
  if (!report.observedAt || Number.isNaN(Date.parse(report.observedAt))) return null;

  return {
    executionId: report.executionId,
    experimentId: report.experimentId,
    hypothesisId: report.hypothesisId,
    targetAccountId: report.targetAccountId,
    targetAudienceId: report.targetAudienceId,
    targetVoiceId: report.targetVoiceId,
    successMetric: report.successMetric,
    controlMetric: report.controlMetric,
    treatmentMetric: report.treatmentMetric,
    controlObservations: report.controlObservations,
    treatmentObservations: report.treatmentObservations,
    observedAt: report.observedAt,
    source: 'experiment-execution',
  };
}

export class StoreBackedPatternExperimentExecutionAdapter implements PatternExperimentExecutionAdapter {
  constructor(private readonly store: PatternExperimentEvidenceStore) {}

  async record(report: PatternExperimentExecutionReport): Promise<PatternExperimentEvidence> {
    throw new Error('not implemented');
  }
}

/**
 * Produces an evaluation result only after the execution report has been
 * accepted as immutable evidence. Evaluation identity remains derived from
 * the execution evidence, never from caller-supplied winner state.
 */
export function evaluateExecutionReport(
  experiment: PatternExperiment,
  report: PatternExperimentExecutionReport,
  evaluate: (experiment: PatternExperiment, observation: ReturnType<typeof bindExperimentEvidence> extends infer T ? Exclude<T, null> : never) => PatternExperimentResult,
): PatternExperimentResult | null {
  const evidence = toPatternExperimentEvidence(experiment, report);
  if (!evidence) return null;
  const observation = bindExperimentEvidence(experiment, evidence);
  return observation ? evaluate(experiment, observation) : null;
}
