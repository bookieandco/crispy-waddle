import { describe, expect, it } from 'vitest';
import { planPatternExperiment, evaluatePatternExperiment } from './social-pattern-experiment.js';
import {
  InMemoryPatternExperimentEvidenceStore,
  bindExperimentEvidence,
  evaluateRecordedExperiment,
  type PatternExperimentEvidence,
} from './social-pattern-experiment-evidence.js';

describe('pattern experiment evidence boundary', () => {
  const hypothesis = {
    id: 'hypothesis:1' as never,
    sourcePatternId: 'pattern:1' as never,
    sourceAccountId: 'account:a' as never,
    targetAccountId: 'account:b' as never,
    targetAudienceId: 'audience:b' as never,
    targetVoiceId: 'voice:b' as never,
    strategy: 'playful_challenge',
    transferableTraits: ['strategy_shape'],
    sourceConfidence: 0.9,
    initialPrior: 0.45,
    status: 'hypothesis' as const,
    requiresLocalValidation: true as const,
  };

  const experiment = planPatternExperiment(hypothesis);
  const evidence = (overrides: Partial<PatternExperimentEvidence> = {}): PatternExperimentEvidence => ({
    executionId: 'execution:1' as never,
    experimentId: experiment.id,
    hypothesisId: experiment.hypothesisId,
    targetAccountId: experiment.targetAccountId,
    targetAudienceId: experiment.targetAudienceId,
    targetVoiceId: experiment.targetVoiceId,
    successMetric: experiment.successMetric,
    controlMetric: 0.1,
    treatmentMetric: 0.12,
    controlObservations: 15,
    treatmentObservations: 15,
    observedAt: '2026-09-01T12:00:00.000Z',
    source: 'experiment-execution',
    ...overrides,
  });

  it('binds only evidence belonging to the exact experiment', () => {
    expect(bindExperimentEvidence(experiment, evidence())?.evaluationId).toBe('execution:1');
    expect(bindExperimentEvidence(experiment, evidence({ targetAccountId: 'account:other' as never }))).toBeNull();
    expect(bindExperimentEvidence(experiment, evidence({ successMetric: 'conversions' }))).toBeNull();
  });

  it('makes evidence immutable and idempotent', async () => {
    const store = new InMemoryPatternExperimentEvidenceStore();
    await store.put(evidence());
    await expect(store.put(evidence())).resolves.toBeUndefined();
    await expect(store.put(evidence({ treatmentMetric: 0.3 }))).rejects.toThrow('experiment evidence is immutable');
  });

  it('evaluates only recorded evidence', async () => {
    const store = new InMemoryPatternExperimentEvidenceStore();
    await store.put(evidence());
    const result = await evaluateRecordedExperiment(experiment, 'execution:1' as never, store, evaluatePatternExperiment);
    expect(result?.promoted).toBe(true);
    expect(await evaluateRecordedExperiment(experiment, 'execution:missing' as never, store, evaluatePatternExperiment)).toBeNull();
  });
});
