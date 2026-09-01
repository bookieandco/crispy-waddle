import { describe, expect, it } from 'vitest';
import { evaluatePatternExperiment, planPatternExperiment } from './social-pattern-experiment.js';

describe('pattern experiments', () => {
  const hypothesis = { id: 'hypothesis:1' as never, sourcePatternId: 'pattern:1' as never, sourceAccountId: 'account:a' as never, targetAccountId: 'account:b' as never, targetAudienceId: 'audience:b' as never, targetVoiceId: 'voice:b' as never, strategy: 'playful_challenge', transferableTraits: ['strategy_shape'], sourceConfidence: 0.9, initialPrior: 0.45, status: 'hypothesis' as const, requiresLocalValidation: true as const };
  it('requires control and treatment', () => {
    const experiment = planPatternExperiment(hypothesis);
    expect(experiment.controlRequired).toBe(true);
    expect(experiment.treatmentRequired).toBe(true);
  });
  it('promotes only a meaningful treatment win', () => {
    const experiment = planPatternExperiment(hypothesis);
    const result = evaluatePatternExperiment(experiment, { experimentId: experiment.id, controlMetric: 0.1, treatmentMetric: 0.12, observations: 30 });
    expect(result.winner).toBe('treatment');
    expect(result.promoted).toBe(true);
  });
  it('honors a custom minimum observation threshold', () => {
    const experiment = planPatternExperiment(hypothesis, 'qualified_leads', 50);
    const result = evaluatePatternExperiment(experiment, { experimentId: experiment.id, controlMetric: 0.1, treatmentMetric: 0.2, observations: 30 });
    expect(result.winner).toBe('inconclusive');
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('insufficient_observations');
  });
  it('rejects results for a different experiment', () => {
    const experiment = planPatternExperiment(hypothesis);
    const result = evaluatePatternExperiment(experiment, { experimentId: 'experiment:other' as never, controlMetric: 0.1, treatmentMetric: 0.2, observations: 30 });
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('experiment_id_mismatch');
  });
});
