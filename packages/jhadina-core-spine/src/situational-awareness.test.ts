import { describe, expect, it } from 'vitest';
import { assessSituation } from './situational-awareness.js';
import { createPersonalitySliderProfile, expressPersonality } from './personality-expression.js';

describe('situational personality expression', () => {
  const profile = createPersonalitySliderProfile({ humor: 90, playfulness: 90, directness: 60 });

  it('suppresses humor and playfulness in serious situations without changing the base profile', () => {
    const signals = assessSituation({
      topicSeverity: 90,
      urgency: 90,
      emotionalLoad: 80,
      explicitSeriousness: 90,
      safetySignal: 90,
      consequenceLevel: 'critical',
    });
    const expression = expressPersonality(profile, signals);

    expect(signals.seriousness).toBeGreaterThanOrEqual(70);
    expect(expression.humor).toBeLessThan(profile.humor);
    expect(expression.playfulness).toBeLessThan(profile.playfulness);
    expect(profile.humor).toBe(90);
    expect(profile.playfulness).toBe(90);
  });

  it('allows high personality expression in a low-severity playful situation', () => {
    const signals = assessSituation({
      topicSeverity: 5,
      urgency: 5,
      emotionalLoad: 5,
      humorSignal: 90,
      consequenceLevel: 'low',
    });
    const expression = expressPersonality(profile, signals);

    expect(signals.seriousness).toBeLessThanOrEqual(30);
    expect(expression.humor).toBeGreaterThan(70);
    expect(expression.playfulness).toBeGreaterThan(70);
  });
});
