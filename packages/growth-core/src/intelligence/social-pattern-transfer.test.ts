import { describe, expect, it } from 'vitest';
import { createPatternHypothesis } from './social-pattern-transfer.js';

describe('pattern transfer', () => {
  const pattern = { patternId: 'pattern:1' as never, sourceAccountId: 'account:pupsonstuff' as never, strategy: 'playful_challenge', tone: 'mascot', signalScore: 0.9, confidence: 0.85, transferableTraits: ['strategy_shape', 'timing_signal'], mustRevalidateOnTargetAccount: true as const };
  it('creates a hypothesis rather than copying behavior', () => {
    const result = createPatternHypothesis({ pattern, targetAccountId: 'account:bookie' as never, targetAudienceId: 'audience:bookie' as never, targetVoiceId: 'voice:bookie' as never });
    expect(result.status).toBe('hypothesis');
    expect(result.requiresLocalValidation).toBe(true);
    expect(result.targetVoiceId).toBe('voice:bookie');
  });
  it('rejects same-account transfers', () => {
    expect(() => createPatternHypothesis({ pattern, targetAccountId: pattern.sourceAccountId, targetAudienceId: 'audience:1' as never, targetVoiceId: 'voice:1' as never })).toThrow('PATTERN_TRANSFER_SAME_ACCOUNT');
  });
});
