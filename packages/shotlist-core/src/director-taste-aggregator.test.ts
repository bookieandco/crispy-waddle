import { describe, expect, it } from 'vitest';
import { aggregateRecipeTaste } from './director-taste-aggregator.js';

describe('aggregateRecipeTaste', () => {
  it('aggregates repeated recipe choices and raises confidence', () => {
    const profile = aggregateRecipeTaste([
      { subject: 'close-up', attribute: 'framing', sentiment: 100, confidence: 40, experienceId: 'e1' },
      { subject: 'close-up', attribute: 'framing', sentiment: 60, confidence: 40, experienceId: 'e2' },
      { subject: 'close-up', attribute: 'framing', sentiment: 100, confidence: 40, experienceId: 'e3' },
      { subject: 'wide', attribute: 'framing', sentiment: -60, confidence: 40, experienceId: 'e4' },
    ]);
    const close = profile.signals.find((s) => s.subject === 'close-up');
    expect(close).toMatchObject({ subject: 'close-up', category: 'style', sentiment: 87, confidence: 70 });
    expect(close?.sourceExperienceIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('keeps conflicting choices separate', () => {
    const profile = aggregateRecipeTaste([
      { subject: 'wide', attribute: 'framing', sentiment: 100, confidence: 40, experienceId: 'e1' },
      { subject: 'close-up', attribute: 'framing', sentiment: 100, confidence: 40, experienceId: 'e2' },
    ]);
    expect(profile.signals).toHaveLength(2);
  });
});
