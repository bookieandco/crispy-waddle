import { describe, expect, it } from 'vitest';
import { evaluatePatternExperiment, planPatternExperiment } from './social-pattern-experiment.js';

describe('pattern experiments', () => {
  const hypothesis = { id: 'hypothesis:1' as never, sourcePatternId: 'pattern:1' as never, sourceAccountId: 'account:a' as never, targetAccountId: 'account:b' as never, targetAudienceId: 'audience:b' as never, targetVoiceId: 'voice:b' as never, strategy: 'playful_challenge', transferableTraits: ['strategy_shape'], sourceConfidence: 0.9, initialPrior: 0.45, status: 'hypothesis' as const, requiresLocalValidation: true as const };
  const observation = (experimentId: string) => ({
    controlMetric: 0.1,
    treatmentMetric: 0.12,
    controlObservations: 15,
    treatmentObservations: 15,
    evaluatedAt: '2026-09-01T12:00:00.000Z',
    evaluationId: 'evaluation:1' as never,
  });

  it('requires control and treatment', () => {
    const experiment = planPatternExperiment(hypothesis);
    expect(experiment.controlRequired).toBe(true);
    expect(experiment.treatmentRequired).toBe(true);
  });

  it('derives provenance and promotes only a meaningful treatment win', () => {
    const experiment = planPatternExperiment(hypothesis);
    const result = evaluatePatternExperiment(experiment, observation(experiment.id));
    expect(result.experimentId).toBe(experiment.id);
    expect(result.hypothesisId).toBe(experiment.hypothesisId);
    expect(result.targetAccountId).toBe(experiment.targetAccountId);
    expect(result.targetAudienceId).toBe(experiment.targetAudienceId);
    expect(result.targetVoiceId).toBe(experiment.targetVoiceId);
    expect(result.successMetric).toBe(experiment.successMetric);
    expect(result.observations).toBe(30);
    expect(result.winner).toBe('treatment');
    expect(result.promoted).toBe(true);
    expect(result.evaluationSource).toBe('pattern-experiment-evaluator');
  });

  it('honors a custom minimum observation threshold', () => {
    const experiment = planPatternExperiment(hypothesis, 'qualified_leads', 50);
    const result = evaluatePatternExperiment(experiment, observation(experiment.id));
    expect(result.winner).toBe('inconclusive');
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('insufficient_observations');
  });

  it('rejects an incomplete population even when total observations are sufficient', () => {
    const experiment = planPatternExperiment(hypothesis);
    const result = evaluatePatternExperiment(experiment, {
      ...observation(experiment.id),
      controlObservations: 0,
      treatmentObservations: 30,
    });
    expect(result.promoted).toBe(false);
    expect(result.reason).toBe('missing_control_or_treatment_population');
  });

  it('rejects missing or invalid evaluation provenance', () => {
    const experiment = planPatternExperiment(hypothesis);
    const missing = evaluatePatternExperiment(experiment, { ...observation(experiment.id), evaluationId: '' as never });
    expect(missing.promoted).toBe(false);
    expect(missing.reason).toBe('missing_evaluation_id');

    const invalidTime = evaluatePatternExperiment(experiment, { ...observation(experiment.id), evaluatedAt: 'not-a-date' });
    expect(invalidTime.promoted).toBe(false);
    expect(invalidTime.reason).toBe('invalid_evaluation_timestamp');
  });
});
