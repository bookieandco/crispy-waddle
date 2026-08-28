import { describe, expect, it } from 'vitest';
import { bridgeTikTokTrendToDistributionOpportunity, bridgeTikTokTrends, type TikTokTrendSignal } from './tiktok-distribution-bridge.js';

const baseSignal: TikTokTrendSignal = {
  id: 'trend:wallet-1',
  topic: 'slim wallets',
  observedAt: '2026-08-27T12:00:00Z',
  velocity: 90,
  engagementRate: 80,
  sharesRate: 70,
  commentsRate: 60,
  savesRate: 75,
  ageHours: 6,
  format: 'UGC product demo',
  hook: 'I switched to this wallet',
  nicheRelevance: 88,
  repeatability: 85,
  creativeNovelty: 72,
  monetizationPotential: 90,
  productionDifficulty: 20,
  evidenceQuality: 95,
  source: 'tiktok-test',
};

describe('TikTok distribution bridge', () => {
  it('converts a trend into a scored distribution opportunity', () => {
    const result = bridgeTikTokTrendToDistributionOpportunity(baseSignal);

    expect(result.signal.topic).toBe('slim wallets');
    expect(result.signal.momentum).toBe(90);
    expect(result.signal.audienceFit).toBe(88);
    expect(result.opportunity.id).toBe('distribution-opportunity:tiktok:trend:wallet-1');
    expect(result.score.score).toBeGreaterThan(70);
    expect(result.opportunity.evidenceSignalIds).toEqual(['tiktok-signal:trend:wallet-1']);
    expect(['test', 'publish']).toContain(result.opportunity.recommendedAction);
  });

  it('uses evidence quality when engagement metrics are absent', () => {
    const result = bridgeTikTokTrendToDistributionOpportunity({
      ...baseSignal,
      engagementRate: undefined,
      sharesRate: undefined,
      commentsRate: undefined,
      savesRate: undefined,
      evidenceQuality: 40,
    });

    expect(result.score.factors.engagementQuality).toBe(40);
  });

  it('decays recency as a trend gets older', () => {
    const fresh = bridgeTikTokTrendToDistributionOpportunity({ ...baseSignal, ageHours: 1 });
    const stale = bridgeTikTokTrendToDistributionOpportunity({ ...baseSignal, ageHours: 240 });

    expect(fresh.score.factors.recency).toBeGreaterThan(stale.score.factors.recency);
  });

  it('ranks multiple trends by opportunity score', () => {
    const low = { ...baseSignal, id: 'trend:low', velocity: 30, nicheRelevance: 30, monetizationPotential: 20 };
    const results = bridgeTikTokTrends([low, baseSignal]);

    expect(results[0].signal.id).toBe('tiktok-signal:trend:wallet-1');
    expect(results[1].signal.id).toBe('tiktok-signal:trend:low');
  });
});
