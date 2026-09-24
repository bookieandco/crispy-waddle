import { describe, expect, it } from 'vitest';
import type { GrowthId } from '../domain/types.js';
import { InMemoryPatternExperimentEvidenceStore, type PatternExperimentEvidence } from './social-pattern-experiment-evidence.js';
import { planPatternExperiment } from './social-pattern-experiment.js';
import { evaluateAndPromoteRecordedExperiment } from './social-pattern-experiment-promotion-pipeline.js';
import { InMemorySocialPatternPromotionStore } from './social-pattern-promotion-store.js';
import { createPatternHypothesis, type PatternHypothesis } from './social-pattern-transfer.js';

describe('evaluateAndPromoteRecordedExperiment', () => {
  const fixture = () => {
    const hypothesis = createPatternHypothesis({
      pattern: {
        id: 'pattern:source' as GrowthId,
        accountId: 'account:source' as GrowthId,
        audienceId: 'audience:source' as GrowthId,
        strategy: 'hook' as never,
        confidence: 0.9,
      } as never,
      targetAccountId: 'account:target' as GrowthId,
      targetAudienceId: 'audience:target' as GrowthId,
      targetVoiceId: 'voice:target' as GrowthId,
    });
    const experiment = planPatternExperiment(hypothesis!);
    return { hypothesis: hypothesis!, experiment };
  };

  const evidence = (experiment: ReturnType<typeof planPatternExperiment>): PatternExperimentEvidence => ({
    executionId: 'execution:1' as GrowthId,
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
  });

  it('evaluates durable evidence and persists only a validated promotion', async () => {
    const { hypothesis, experiment } = fixture();
    const evidenceStore = new InMemoryPatternExperimentEvidenceStore();
    const promotionStore = new InMemorySocialPatternPromotionStore();
    await evidenceStore.put(evidence(experiment));

    const result = await evaluateAndPromoteRecordedExperiment(
      experiment,
      hypothesis,
      'execution:1' as GrowthId,
      evidenceStore,
      promotionStore,
    );

    expect(result?.evaluation.winner).toBe('treatment');
    expect(result?.promotion?.targetAccountId).toBe('account:target');
    expect(await promotionStore.listForAccount('account:target' as GrowthId)).toHaveLength(1);
  });

  it('rejects swapped target provenance before promotion', async () => {
    const { hypothesis, experiment } = fixture();
    const evidenceStore = new InMemoryPatternExperimentEvidenceStore();
    const promotionStore = new InMemorySocialPatternPromotionStore();
    await evidenceStore.put({ ...evidence(experiment), targetAccountId: 'account:attacker' as GrowthId });

    const result = await evaluateAndPromoteRecordedExperiment(
      experiment,
      hypothesis,
      'execution:1' as GrowthId,
      evidenceStore,
      promotionStore,
    );

    expect(result).toBeNull();
    expect(await promotionStore.listForAccount('account:target' as GrowthId)).toHaveLength(0);
  });

  it('rejects a hypothesis from another experiment', async () => {
    const { hypothesis, experiment } = fixture();
    const other = { ...hypothesis, id: 'hypothesis:attacker' as GrowthId } as PatternHypothesis;
    const evidenceStore = new InMemoryPatternExperimentEvidenceStore();
    const promotionStore = new InMemorySocialPatternPromotionStore();
    await evidenceStore.put(evidence(experiment));

    const result = await evaluateAndPromoteRecordedExperiment(
      experiment,
      other,
      'execution:1' as GrowthId,
      evidenceStore,
      promotionStore,
    );

    expect(result).toBeNull();
    expect(await promotionStore.listForAccount(experiment.targetAccountId)).toHaveLength(0);
  });
});
