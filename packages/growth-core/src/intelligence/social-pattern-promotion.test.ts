import { describe, expect, it } from 'vitest';
import { promoteValidatedPattern } from './social-pattern-promotion.js';

describe('pattern promotion', () => {
  const hypothesis = { id: 'hypothesis:1' as never, sourcePatternId: 'pattern:1' as never, sourceAccountId: 'account:a' as never, targetAccountId: 'account:b' as never, targetAudienceId: 'audience:b' as never, targetVoiceId: 'voice:b' as never, strategy: 'playful_challenge', transferableTraits: ['strategy_shape'], sourceConfidence: 0.8, initialPrior: 0.4, status: 'hypothesis' as const, requiresLocalValidation: true as const };
  it('promotes a validated treatment winner and preserves provenance', () => {
    const result = promoteValidatedPattern(hypothesis, { experimentId: 'experiment:1' as never, controlMetric: 0.1, treatmentMetric: 0.13, observations: 30, minimumObservations: 30, winner: 'treatment', promoted: true, reason: 'treatment_exceeded_control_by_at_least_10_percent' });
    expect(result?.status).toBe('promoted');
    expect(result?.targetAccountId).toBe('account:b');
    expect(result?.sourcePatternId).toBe('pattern:1');
    expect(result?.sourceAccountId).toBe('account:a');
  });
  it('does not promote below the experiment threshold', () => {
    const result = promoteValidatedPattern(hypothesis, { experimentId: 'experiment:1' as never, controlMetric: 0.1, treatmentMetric: 0.13, observations: 30, minimumObservations: 50, winner: 'treatment', promoted: true, reason: 'treatment_exceeded_control_by_at_least_10_percent' });
    expect(result).toBeNull();
  });
  it('quarantines non-winners', () => {
    const result = promoteValidatedPattern(hypothesis, { experimentId: 'experiment:2' as never, controlMetric: 0.1, treatmentMetric: 0.1, observations: 30, minimumObservations: 30, winner: 'inconclusive', promoted: false, reason: 'difference_within_10_percent' });
    expect(result).toBeNull();
  });
});
