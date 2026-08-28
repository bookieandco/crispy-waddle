import { describe, expect, it } from 'vitest';
import { createDefaultDomainRegistry } from './domain-bootstrap.js';
import { createOperatingModel, applyDomainPersonalityModifiers } from './operating-model.js';
import { createPersonalitySliderProfile, expressPersonality } from './personality-expression.js';
import { assessSituation } from './situational-awareness.js';

describe('operating context contract', () => {
  it('combines global personality, situation, and domain modifiers without mutating the profile', () => {
    const profile = createPersonalitySliderProfile({ humor: 80, playfulness: 75 });
    const model = createOperatingModel(profile);
    const registry = createDefaultDomainRegistry();
    const music = registry.get('music');
    const situation = assessSituation({ topicSeverity: 10, humorSignal: 80 });
    const base = expressPersonality(model.personality, situation);
    const expression = applyDomainPersonalityModifiers(base, music?.context.personalityModifiers);

    expect(music).toBeDefined();
    expect(expression.humor).toBeGreaterThanOrEqual(base.humor);
    expect(expression.playfulness).toBeGreaterThanOrEqual(base.playfulness);
    expect(profile.humor).toBe(80);
    expect(profile.playfulness).toBe(75);
  });

  it('lets a critical situation override a domain tendency toward playfulness', () => {
    const profile = createPersonalitySliderProfile({ humor: 90, playfulness: 90 });
    const registry = createDefaultDomainRegistry();
    const safety = registry.get('safety');
    const situation = assessSituation({ topicSeverity: 100, urgency: 100, safetySignal: 100, consequenceLevel: 'critical', humorSignal: 100 });
    const base = expressPersonality(profile, situation);
    const expression = applyDomainPersonalityModifiers(base, safety?.context.personalityModifiers);

    expect(expression.humor).toBe(0);
    expect(expression.playfulness).toBe(0);
  });
});
