import type { GrowthId } from '../domain/types.js';
import type { PatternExperiment, PatternExperimentObservation, PatternExperimentResult } from './social-pattern-experiment.js';

export interface PatternExperimentEvidence {
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
  readonly source: 'experiment-execution';
}

export interface PatternExperimentEvidenceStore {
  getByExecutionId(executionId: GrowthId): Promise<PatternExperimentEvidence | null>;
  put(evidence: PatternExperimentEvidence): Promise<void>;
}

export class InMemoryPatternExperimentEvidenceStore implements PatternExperimentEvidenceStore {
  private readonly records = new Map<GrowthId, PatternExperimentEvidence>();

  async getByExecutionId(executionId: GrowthId): Promise<PatternExperimentEvidence | null> {
    return this.records.get(executionId) ?? null;
  }

  async put(evidence: PatternExperimentEvidence): Promise<void> {
    const existing = this.records.get(evidence.executionId);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(evidence)) {
        throw new Error('experiment evidence is immutable');
      }
      return;
    }
    this.records.set(evidence.executionId, evidence);
  }
}

export function bindExperimentEvidence(
  experiment: PatternExperiment,
  evidence: PatternExperimentEvidence,
): PatternExperimentObservation | null {
  if (evidence.experimentId !== experiment.id) return null;
  if (evidence.hypothesisId !== experiment.hypothesisId) return null;
  if (evidence.targetAccountId !== experiment.targetAccountId) return null;
  if (evidence.targetAudienceId !== experiment.targetAudienceId) return null;
  if (evidence.targetVoiceId !== experiment.targetVoiceId) return null;
  if (evidence.successMetric !== experiment.successMetric) return null;
  if (evidence.source !== 'experiment-execution') return null;
  return {
    controlMetric: evidence.controlMetric,
    treatmentMetric: evidence.treatmentMetric,
    controlObservations: evidence.controlObservations,
    treatmentObservations: evidence.treatmentObservations,
    evaluatedAt: evidence.observedAt,
    evaluationId: evidence.executionId,
  };
}

export async function evaluateRecordedExperiment(
  experiment: PatternExperiment,
  executionId: GrowthId,
  store: PatternExperimentEvidenceStore,
  evaluate: (experiment: PatternExperiment, observation: PatternExperimentObservation) => PatternExperimentResult,
): Promise<PatternExperimentResult | null> {
  const evidence = await store.getByExecutionId(executionId);
  if (!evidence) return null;
  const observation = bindExperimentEvidence(experiment, evidence);
  return observation ? evaluate(experiment, observation) : null;
}
