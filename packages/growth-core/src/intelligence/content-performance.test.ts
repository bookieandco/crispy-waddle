import { describe, expect, it } from 'vitest';
import { assessContentPerformance } from './content-performance.js';

describe('assessContentPerformance', () => {
  it('scales strong content', () => {
    const result = assessContentPerformance({
      assetId: 'asset-1',
      platform: 'tiktok',
      impressions: 10000,
      views: 9000,
      completionRate: 0.6,
      ctr: 0.025,
      saves: 500,
      leads: 100,
      purchases: 20,
      spend: 100,
      revenue: 600,
    });
    expect(result.verdict).toBe('scale');
    expect(result.score).toBeGreaterThan(0.65);
  });

  it('holds low-volume content instead of killing it prematurely', () => {
    const result = assessContentPerformance({
      assetId: 'asset-2',
      platform: 'instagram',
      impressions: 300,
      views: 250,
      completionRate: 0.1,
      ctr: 0.005,
    });
    expect(result.verdict).toBe('hold');
  });
});
