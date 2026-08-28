import { describe, expect, it } from 'vitest';
import { applyJhadinaDirectorContext, expressDirectorContext } from './jhadina-director-context.js';

describe('Jhadina director context', () => {
  const base = { sliders: { playfulness: 90, intensity: 70, riskTolerance: 80 }, situation: 'playful' as const, taste: { version: 1, signals: [] } };

  it('lets high playfulness shape a playful directing context', () => {
    expect(expressDirectorContext(base)).toMatchObject({ tone: 'playful', jokePermission: 90, energy: 70, creativeRisk: 80 });
  });

  it('suppresses joking when the situation is serious even with high playfulness', () => {
    expect(expressDirectorContext({ ...base, situation: 'serious' })).toMatchObject({ tone: 'serious', jokePermission: 0, creativeRisk: 60 });
  });

  it('uses learned taste while preserving explicit controls', () => {
    const controls = { framing: 'wide' } as any;
    const taste = { version: 1, signals: [{ category: 'framing', subject: 'close-up', sentiment: 90, confidence: 80 }] } as any;
    expect(applyJhadinaDirectorContext(controls, { ...base, taste })).toMatchObject({ framing: 'wide', performanceIntensity: 70 });
  });
});
