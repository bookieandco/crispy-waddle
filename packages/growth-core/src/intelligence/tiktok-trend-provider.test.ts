import { describe, expect, it, vi } from 'vitest';
import type { GrowthId } from '../domain/types.js';
import { ingestTikTokTrends, type TikTokTrendProvider } from './tiktok-trend-provider.js';

describe('ingestTikTokTrends', () => {
  it('normalizes provider output without coupling Growth Core to provider details', async () => {
    const provider: TikTokTrendProvider = {
      providerId: 'test-tiktok-provider',
      discoverTrends: vi.fn().mockResolvedValue([
        {
          id: 'trend:1' as GrowthId,
          topic: 'wallets',
          observedAt: '2026-08-28T00:00:00.000Z',
          velocity: 82,
          nicheRelevance: 90,
          repeatability: 85,
          creativeNovelty: 70,
          monetizationPotential: 88,
          productionDifficulty: 20,
        },
      ]),
    };

    const result = await ingestTikTokTrends(provider, {
      niche: 'mens accessories',
      observedAt: '2026-08-28T00:00:00.000Z',
    });

    expect(provider.discoverTrends).toHaveBeenCalledWith({
      niche: 'mens accessories',
      observedAt: '2026-08-28T00:00:00.000Z',
    });
    expect(result.providerId).toBe('test-tiktok-provider');
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].topic).toBe('wallets');
  });
});
