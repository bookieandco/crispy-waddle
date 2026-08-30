import { describe, expect, it } from 'vitest';
import { matchBuyerToOffers } from './buyer-offer-matching.js';

describe('buyer offer matching', () => {
  it('ranks an available topic-matched offer first', () => {
    const matches = matchBuyerToOffers({
      id: 'buyer:1' as never,
      platform: 'instagram',
      topic: 'pet portraits',
      intentLevel: 'high',
      evidence: ['where-buy', 'price'] as string[],
      recencyScore: 0.9,
      confidence: 0.9,
    }, [
      { offerId: 'offer:1' as never, name: 'Custom Pet Portrait', topics: ['pet portraits'], audienceTags: ['pet owners'], commercialSignals: ['buy'], availability: 'available' },
      { offerId: 'offer:2' as never, name: 'Dog Toy', topics: ['toys'], audienceTags: ['pet owners'], commercialSignals: ['buy'], availability: 'available' },
    ]);

    expect(matches[0].offerId).toBe('offer:1');
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it('does not match unavailable offers', () => {
    const matches = matchBuyerToOffers({ id: 'buyer:2' as never, platform: 'tiktok', topic: 'pet portraits', intentLevel: 'high', evidence: ['buy'], recencyScore: 1, confidence: 1 }, [
      { offerId: 'offer:1' as never, name: 'Portrait', topics: ['pet portraits'], audienceTags: [], commercialSignals: [], availability: 'unavailable' },
    ]);
    expect(matches).toHaveLength(0);
  });
});
