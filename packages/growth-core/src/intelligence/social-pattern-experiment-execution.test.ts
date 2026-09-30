import { describe, expect, it } from 'vitest';
import type { PatternExperiment } from './social-pattern-experiment.js';
import {
  StoreBackedPatternExperimentExecutionAdapter,
  evaluateExecutionReport,
  toPatternExperimentEvidence,
  type PatternExperimentExecutionReport,
} from './social-pattern-experiment-execution.js';
import { InMemoryPatternExperimentEvidenceStore } from './social-pattern-experiment-evidence.js';
import { evaluatePatternExperiment } from './social-pattern-experiment.js';

type MutableReport = Omit<PatternExperimentExecutionReport, 'executionId' | 'experimentId' | 'hypothesisId' | 'targetAccountId' | 'targetAudienceId' | 'targetVoiceId'> & {
  executionId: PatternExperimentExecutionReport['executionId'];
  experimentId: PatternExperimentExecutionReport['experimentId'];
  hypothesisId: PatternExperimentExecutionReport['hypothesisId'];
  targetAccountId: PatternExperimentExecutionReport['targetAccountId'];
  targetAudienceId: PatternExperimentExecutionReport['targetAudienceId'];
  targetVoiceId: PatternExperimentExecutionReport['targetVoiceId'];
};

const experiment: PatternExperiment = {
  id: 'pattern-experiment:hypothesis:1' as never,
  hypothesisId: 'hypothesis:1' as never,
  targetAccountId: 'account:target' as never,
  targetAudienceId: 'audience:1' as never,
  targetVoiceId: 'voice:1' as never,
  strategy: 'hook-and-proof',
  controlRequired: true,
  treatmentRequired: true,
  successMetric: 'qualified_leads',
  minimumObservations: 30,
  status: 'planned',
};

const report = (): PatternExperimentExecutionReport => ({
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
});

describe('pattern experiment execution boundary', () => {
  it('binds a valid execution report to immutable experiment identity', () => {
    const evidence = toPatternExperimentEvidence(experiment, report());
    expect(evidence).toMatchObject({
      executionId: 'execution:1',
      experimentId: experiment.id,
      targetAccountId: experiment.targetAccountId,
      source: 'experiment-execution',
    });
  });

  it.each([
    ['experimentId', { experimentId: 'pattern-experiment:other' }],
    ['hypothesisId', { hypothesisId: 'hypothesis:other' }],
    ['targetAccountId', { targetAccountId: 'account:other' }],
    ['targetAudienceId', { targetAudienceId: 'audience:other' }],
    ['targetVoiceId', { targetVoiceId: 'voice:other' }],
    ['successMetric', { successMetric: 'conversions' }],
  ])('rejects mismatched %s', (_field, patch) => {
    const invalid = { ...report(), ...patch } as MutableReport;
    expect(toPatternExperimentEvidence(experiment, invalid)).toBeNull();
  });

  it.each([
    ['controlMetric', -0.01, 'treatmentMetric', 0.12],
    ['controlMetric', 1.01, 'treatmentMetric', 0.12],
    ['controlMetric', Number.NaN, 'treatmentMetric', 0.12],
    ['controlMetric', 0.1, 'treatmentMetric', Number.NaN],
  ])('rejects invalid rate metrics', (_a, controlMetric, _b, treatmentMetric) => {
    expect(toPatternExperimentEvidence(experiment, { ...report(), controlMetric, treatmentMetric })).toBeNull();
  });

  it.each([
    ['controlObservations', 0],
    ['treatmentObservations', 0],
    ['controlObservations', -1],
    ['treatmentObservations', 1.5],
    ['controlObservations', Number.NaN],
  ])('rejects invalid %s population', (field, value) => {
    expect(toPatternExperimentEvidence(experiment, { ...report(), [field]: value })).toBeNull();
  });

  it('rejects missing or invalid execution provenance', () => {
    expect(toPatternExperimentEvidence(experiment, { ...report(), executionId: '' as never })).toBeNull();
    expect(toPatternExperimentEvidence(experiment, { ...report(), observedAt: 'not-a-date' })).toBeNull();
  });

  it('persists only validated evidence through the store-backed adapter', async () => {
    const store = new InMemoryPatternExperimentEvidenceStore();
    const adapter = new StoreBackedPatternExperimentExecutionAdapter(store);
    const evidence = await adapter.record(experiment, report());
    await expect(store.getByExecutionId(evidence.executionId)).resolves.toEqual(evidence);
  });

  it('rejects a second payload for the same execution id when immutable evidence changes', async () => {
    const store = new InMemoryPatternExperimentEvidenceStore();
    const adapter = new StoreBackedPatternExperimentExecutionAdapter(store);
    await adapter.record(experiment, report());
    await expect(adapter.record(experiment, { ...report(), treatmentMetric: 0.2 })).rejects.toThrow('experiment evidence is immutable');
  });

  it('evaluates only after the report has passed the execution binding boundary', () => {
    const result = evaluateExecutionReport(experiment, report(), evaluatePatternExperiment);
    expect(result?.winner).toBe('treatment');
    expect(result?.promoted).toBe(true);
    expect(result?.evaluationId).toBe('execution:1');
  });
});
