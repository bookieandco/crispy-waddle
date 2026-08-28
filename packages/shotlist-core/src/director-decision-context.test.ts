import { describe, expect, it } from 'vitest';
import { buildDirectorDecisionGuidance } from './director-decision-context.js';

describe('buildDirectorDecisionGuidance', () => {
  const base = {
    sliders: { humor: 90, playfulness: 90, curiosity: 80, boldness: 90, warmth: 80, formality: 20 },
    taste: { signals: [{ category: 'style', subject: 'film-noir', sentiment: 90, confidence: 80, sourceExperienceIds: ['e1', 'e2'] }] },
    storyIntent: 'intimate character drama',
  };

  it('allows personality to express itself in a playful situation', () => {
    const result = buildDirectorDecisionGuidance({ ...base, mode: 'playful' });
    expect(result.tone).toBe('playful');
    expect(result.jokePermission).toBe(90);
    expect(result.creativeRisk).toBe(90);
    expect(result.controls.lookPreset).toBe('film-noir');
  });

  it('suppresses joking and caps risk when the situation is serious', () => {
    const result = buildDirectorDecisionGuidance({ ...base, mode: 'serious' });
    expect(result.tone).toBe('serious');
    expect(result.jokePermission).toBe(0);
    expect(result.creativeRisk).toBe(45);
  });

  it('treats urgent situations as operationally constrained', () => {
    const result = buildDirectorDecisionGuidance({ ...base, mode: 'urgent' });
    expect(result.tone).toBe('urgent');
    expect(result.jokePermission).toBe(0);
    expect(result.creativeRisk).toBe(20);
  });

  it('uses resolved behavioral sliders instead of the baseline personality sliders', () => {
    const result = buildDirectorDecisionGuidance({
      ...base,
      mode: 'serious',
      behavioralState: {
        mode: 'serious',
        sliders: { humor: 5, playfulness: 10, boldness: 40, warmth: 95, seriousness: 100 },
        domain: 'directoros',
      },
    });
    expect(result.jokePermission).toBe(5);
    expect(result.creativeRisk).toBe(40);
    expect(result.tone).toBe('serious');
  });
});
