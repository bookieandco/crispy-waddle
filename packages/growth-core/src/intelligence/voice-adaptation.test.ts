import { describe, expect, it } from 'vitest';
import { bindVoiceToAdaptation } from './voice-adaptation.js';

describe('voice adaptation', () => {
  const plan = { id: 'adaptation:1' as never, accountId: 'account:pupsonstuff' as never, brandId: 'brand:pupsonstuff' as never, tone: 'mascot' as const, preserve: [], transform: [], prohibit: [], sourcePatternId: 'pattern:1' as never, provenance: ['pattern:source'], requiresHumanReview: true as const };
  it('binds the account voice profile to the adaptation', () => {
    const result = bindVoiceToAdaptation(plan, { id: 'voice:1' as never, accountId: 'account:pupsonstuff' as never, traits: ['playful', 'mischievous'], preferredPhrases: ['good boy'], forbiddenPatterns: ['mean-spirited'], intensity: 0.8, playfulness: 0.95, directness: 0.7, provenance: ['voice:source'] });
    expect(result.voiceProfileId).toBe('voice:1');
    expect(result.traits).toContain('mischievous');
    expect(result.styleWeights.playfulness).toBe(0.95);
    expect(result.provenance).toHaveLength(2);
  });
  it('rejects a voice profile belonging to another account', () => {
    expect(() => bindVoiceToAdaptation(plan, { id: 'voice:2' as never, accountId: 'account:other' as never, traits: [], preferredPhrases: [], forbiddenPatterns: [], intensity: 0, playfulness: 0, directness: 0, provenance: [] })).toThrow('VOICE_PROFILE_ACCOUNT_MISMATCH');
  });
});
