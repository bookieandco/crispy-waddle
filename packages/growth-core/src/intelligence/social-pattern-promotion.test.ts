import { describe, expect, it } from 'vitest';
import { promoteValidatedPattern } from './social-pattern-promotion.js';
import { evaluatePatternExperiment, planPatternExperiment, type PatternExperimentResult } from './social-pattern-experiment.js';

describe('pattern promotion', () => {
  const hypothesis = { id: 'hypothesis:1' as never, sourcePatternId: 'pattern:1' as never, sourceAccountId: 'account:a' as never, targetAccountId: 'account:b' as never, targetAudienceId: 'audience:b' as never, targetVoiceId: 'voice:b' as never, strategy: 'playful_challenge', transferableTraits: ['strategy_shape'], sourceConfidence: 0.8, initialPrior: 0.4, status: 'hypothesis' as const, requiresLocalValidation: true as const };
  const experiment = planPatternExperiment(hypothesis);
  const evaluated = (): PatternExperimentResult => evaluatePatternExperiment(experiment, {
    controlMetric: 0.1,
    treatmentMetric: 0.13,
    controlObservations: 15,
    treatmentObservations: 15,
    evaluatedAt: '2026-09-01T12:00:00.000Z',
    evaluationId: 'evaluation:1' as never,
  });

  it('promotes a validated treatment winner and preserves provenance', () => {
    const result = promoteValidatedPattern(hypothesis, evaluated());
    expect(result?.status).toBe('promoted');
    expect(result?.targetAccountId).toBe('account:b');
    expect(result?.sourcePatternId).toBe('pattern:1');
    expect(result?.sourceAccountId).toBe('account:a');
  });

  it('rejects a result bound to another hypothesis/account/audience/voice', () => {
    const base = evaluated();
    expect(promoteValidatedPattern(hypothesis, { ...base, hypothesisId: 'hypothesis:other' as never })).toBeNull();
    expect(promoteValidatedPattern(hypothesis, { ...base, targetAccountId: 'account:other' as never })).toBeNull();
    expect(promoteValidatedPattern(hypothesis, { ...base, targetAudienceId: 'audience:other' as never })).toBeNull();
    expect(promoteValidatedPattern(hypothesis, { ...base, targetVoiceId: 'voice:other' as never })).toBeNull();
  });

  it('rejects fabricated evaluator provenance', () => {
    const base = evaluated();
    expect(promoteValidatedPattern(hypothesis, { ...base, evaluationSource: 'fabricated' as never })).toBeNull();
    expect(promoteValidatedPattern(hypothesis, { ...base, experimentId: 'experiment:other' as never })).toBeNull();
  });

  it('does not promote below the experiment threshold', () => {
    const base = evaluated();
    expect(promoteValidatedPattern(hypothesis, { ...base, observations: 20, winner: 'inconclusive', promoted: false, reason: 'insufficient_observations' })).toBeNull();
  });

  it('quarantines non-winners and sub-threshold lift', () => {
    const base = evaluated();
    expect(promoteValidatedPattern(hypothesis, { ...base, winner: 'control', promoted: false })).toBeNull();
    expect(promoteValidatedPattern(hypothesis, { ...base, treatmentMetric: 0.109, winner: 'treatment', promoted: true })).toBeNull();
  });
});
