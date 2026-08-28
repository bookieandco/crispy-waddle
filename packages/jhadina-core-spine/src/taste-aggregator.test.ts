import { describe, expect, it } from 'vitest';
import { aggregateTaste } from './taste-aggregator.js';

describe('aggregateTaste', () => {
  it('raises confidence as repeated experiences corroborate a preference', () => {
    const profile = aggregateTaste([
      { subject: 'psychological thriller', category: 'genre', sentiment: 80, experienceId: 'e1' },
      { subject: 'psychological thriller', category: 'genre', sentiment: 90, experienceId: 'e2' },
      { subject: 'psychological thriller', category: 'genre', sentiment: 70, experienceId: 'e3' },
    ]);
    expect(profile.signals[0]).toMatchObject({ subject: 'psychological thriller', category: 'genre', sentiment: 80, confidence: 65 });
    expect(profile.signals[0].sourceExperienceIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('allows contradictory experiences to pull sentiment toward neutral instead of locking identity', () => {
    const profile = aggregateTaste([
      { subject: 'horror', category: 'genre', sentiment: 90, experienceId: 'e1' },
      { subject: 'horror', category: 'genre', sentiment: -90, experienceId: 'e2' },
    ]);
    expect(profile.signals[0]).toMatchObject({ sentiment: 0, confidence: 55 });
  });
});
