import { describe, expect, it } from 'vitest';
import { assessSituation, resolveSituationalBehavior } from './situational-awareness.js';

describe('situational personality expression', () => {
  const base = { humor: 90, playfulness: 90, directness: 60, seriousness: 30, warmth: 70 };

  it('suppresses humor and playfulness in urgent situations without changing the base profile', () => {
    const signals = assessSituation({ urgency: 100, safetySignal: 100, consequenceLevel: 'critical' });
    const expression = resolveSituationalBehavior({ sliders: base, signals });
    expect(expression.mode).toBe('URGENT');
    expect(expression.sliders).toMatchObject({ humor: 5, playfulness: 15, seriousness: 100 });
    expect(base).toMatchObject({ humor: 90, playfulness: 90, seriousness: 30 });
  });

  it('allows high humor when the situation is playful and jokes are requested', () => {
    const signals = assessSituation({ topicSeverity: 0, urgency: 0, emotionalLoad: 0, consequenceLevel: 'low' });
    const expression = resolveSituationalBehavior({ sliders: { humor: 40, playfulness: 40 }, signals, userExplicitlyRequestedJokes: true });
    expect(expression.mode).toBe('PLAYFUL');
    expect(expression.sliders.humor).toBe(90);
  });
});
