import { describe, expect, it } from 'vitest';
import { buildMarketPulse, clusterSocialObservations } from './market-pulse.js';

const observation = (id: string, platform: 'instagram' | 'tiktok', topic: string, commercialSignals: string[] = [], audienceSignals: string[] = []) => ({
  id: id as never,
  platform,
  sourceUrl: `https://example.com/${id}`,
  observedAt: new Date().toISOString(),
  mediaType: 'video' as const,
  topic,
  engagement: { views: 10_000, likes: 1_000, comments: 100, shares: 50, saves: 50 },
  audienceSignals,
  commercialSignals,
  provenance: ['public'],
});

describe('market pulse', () => {
  it('clusters equivalent normalized topics across platforms', () => {
    const clusters = clusterSocialObservations([
      observation('1', 'instagram', 'Personalized Pet Gifts'),
      observation('2', 'tiktok', 'personalized pet gifts'),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].platforms).toEqual(expect.arrayContaining(['instagram', 'tiktok']));
    expect(clusters[0].observationCount).toBe(2);
  });

  it('surfaces commercial and buyer-signal topics separately', () => {
    const pulse = buildMarketPulse([
      observation('1', 'instagram', 'Pet Portraits', ['price'], ['where can I buy']),
      observation('2', 'tiktok', 'Pet Portraits', ['shipping'], ['how much']),
      observation('3', 'instagram', 'Funny Dogs'),
    ], '2026-08-01T00:00:00Z', '2026-08-30T00:00:00Z');

    expect(pulse.commercialTopics).toHaveLength(1);
    expect(pulse.buyerIntentTopics).toHaveLength(1);
    expect(pulse.clusters).toHaveLength(2);
  });
});
