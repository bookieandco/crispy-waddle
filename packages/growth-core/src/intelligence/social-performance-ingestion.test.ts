import { describe, expect, it } from 'vitest';
import { ingestSocialPerformance, normalizeSocialPerformance } from './social-performance-ingestion.js';

describe('social performance ingestion', () => {
  it('normalizes provider metrics into canonical content telemetry', () => {
    const result = normalizeSocialPerformance({
      platform: ' TikTok ', providerPostId: 'tt-1', assetId: 'asset-1', capturedAt: '2026-08-27T12:00:00Z',
      impressions: 1000, views: 900, ctr: 0.025, saves: 20, revenue: 120,
    });
    expect(result.platform).toBe('tiktok');
    expect(result.impressions).toBe(1000);
    expect(result.ctr).toBe(0.025);
    expect(result.revenue).toBe(120);
  });

  it('isolates invalid records instead of failing the batch', () => {
    const result = ingestSocialPerformance([
      { platform: 'Instagram', providerPostId: 'ig-1', assetId: 'asset-1', capturedAt: '2026-08-27T12:00:00Z', views: 50 },
      { platform: '', providerPostId: 'bad', assetId: 'asset-2', capturedAt: '2026-08-27T12:00:00Z' },
      { platform: 'TikTok', providerPostId: '', assetId: 'asset-3', capturedAt: '2026-08-27T12:00:00Z' },
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });

  it('prevents negative provider telemetry from entering Growth Core', () => {
    const result = normalizeSocialPerformance({
      platform: 'facebook', providerPostId: 'fb-1', assetId: 'asset-1', capturedAt: '2026-08-27T12:00:00Z',
      impressions: -10, views: -5, spend: -1,
    });
    expect(result.impressions).toBe(0);
    expect(result.views).toBe(0);
    expect(result.spend).toBe(0);
  });
});
