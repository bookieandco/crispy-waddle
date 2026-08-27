import { describe, expect, it } from 'vitest';
import { aggregateDirectorPreferences, observationsFromTakeFeedback } from './director-taste-aggregation.js';

describe('director taste aggregation', () => {
  it('attributes repeated feedback to concrete directing controls', () => {
    const observations = [
      ...observationsFromTakeFeedback({ takeId: 't1', shotId: 's1', reaction: 'love', observedAt: '2026-08-27T00:00:00.000Z' }, { framing: 'close-up', lightingMood: 'moody' }),
      ...observationsFromTakeFeedback({ takeId: 't2', shotId: 's2', reaction: 'like', observedAt: '2026-08-27T00:01:00.000Z' }, { framing: 'close-up', lightingMood: 'moody' }),
    ];
    const preferences = aggregateDirectorPreferences(observations);
    expect(preferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ attribute: 'framing', value: 'close-up', sentiment: 80, confidence: 54 }),
      expect.objectContaining({ attribute: 'lightingMood', value: 'moody', sentiment: 80, confidence: 54 }),
    ]));
  });

  it('does not manufacture a preference from controls that were not present', () => {
    const observations = observationsFromTakeFeedback({ takeId: 't3', shotId: 's3', reaction: 'love', observedAt: '2026-08-27T00:00:00.000Z' }, { lens: '50mm' });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ attribute: 'lens', value: '50mm', sentiment: 100 });
  });
});
