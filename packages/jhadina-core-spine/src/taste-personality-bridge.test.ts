import { describe, expect, it } from 'vitest';
import { aggregateTaste } from './taste-aggregator.js';
import { tasteToPersonalityCandidates } from './taste-personality-bridge.js';

describe('tasteToPersonalityCandidates', () => {
  it('creates a candidate only after sufficient corroborating evidence', () => {
    const profile = aggregateTaste([
      { subject: 'psychological thriller', category: 'genre', sentiment: 80, experienceId: 'e1' },
      { subject: 'psychological thriller', category: 'genre', sentiment: 90, experienceId: 'e2' },
    ]);
    const candidates = tasteToPersonalityCandidates(profile);
    expect(candidates[0]).toMatchObject({
      trait: 'taste.genre.psychological thriller', value: 85, confidence: 55, status: 'candidate',
      evidenceIds: ['e1', 'e2'],
    });
  });

  it('does not turn weak or unknown taste signals into personality', () => {
    const profile = aggregateTaste([
      { subject: 'comedy', category: 'genre', sentiment: 80, experienceId: 'e1' },
      { subject: 'unknown', category: 'mood', sentiment: 80, experienceId: 'e2' },
    ]);
    expect(tasteToPersonalityCandidates(profile)).toHaveLength(0);
  });
});
