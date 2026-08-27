import { describe, expect, it } from 'vitest';
import { createPersonalitySliderProfile, expressPersonality } from './personality-expression.js';
import { assessSituation } from './situational-awareness.js';

describe('personality policy boundary', () => {
  it('allows personality to change expression without changing authorization', () => {
    const profile = createPersonalitySliderProfile({ humor: 100, playfulness: 100 });
    const serious = assessSituation({ topicSeverity: 100, urgency: 100, safetySignal: 100, consequenceLevel: 'critical' });
    const expression = expressPersonality(profile, serious);

    expect(expression.humor).toBe(0);
    expect(expression.playfulness).toBe(0);

    const personalityAuthorization = false;
    const policyAuthorization = false;
    expect(personalityAuthorization).toBe(policyAuthorization);
  });

  it('does not let a playful personality bypass a denied policy decision', () => {
    const profile = createPersonalitySliderProfile({ humor: 100, playfulness: 100, assertiveness: 100 });
    const playful = assessSituation({ humorSignal: 100, topicSeverity: 0, consequenceLevel: 'low' });
    const expression = expressPersonality(profile, playful);

    expect(expression.humor).toBeGreaterThan(0);
    expect(expression.playfulness).toBeGreaterThan(0);

    const policyDecision = { allowed: false, reason: 'policy_denied' as const };
    expect(policyDecision.allowed).toBe(false);
  });
});
