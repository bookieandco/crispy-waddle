import { describe, expect, it } from 'vitest';
import {
  assessCreativePerformance,
  discoverCreativePattern,
  generateControlledVariants,
} from './creative-format-intelligence.js';

describe('creative format intelligence', () => {
  it('scores variants from observable performance evidence', () => {
    const result = assessCreativePerformance([
      {
        id: 'e1', variantId: 'v1', platform: 'tiktok', publishedAt: '2026-08-27T00:00:00Z',
        impressions: 10000, views: 9000, completionRate: 0.6, replayRate: 0.1,
        clicks: 300, conversions: 30,
      },
      {
        id: 'e2', variantId: 'v2', platform: 'tiktok', publishedAt: '2026-08-27T00:00:00Z',
        impressions: 10000, views: 9000, completionRate: 0.1, replayRate: 0,
        clicks: 20, conversions: 1,
      },
    ]);

    expect(result.find((x) => x.variantId === 'v1')?.recommendation).toBe('promote');
    expect(result.find((x) => x.variantId === 'v2')?.recommendation).toBe('archive');
  });

  it('turns repeated wins into a reusable pattern with bounded confidence', () => {
    const pattern = discoverCreativePattern(
      'Rapid-fire mistakes',
      {
        hook: 'name the mistake immediately', opening: 'first three seconds are direct',
        problem: 'common costly error', proof: 'specific example', pacing: 'rapid',
        cta: 'save/share', format: 'short_video', audience: 'operators', offer: 'guide',
      },
      [
        { id: 'e1', variantId: 'v1', platform: 'tiktok', publishedAt: '2026-08-27T00:00:00Z', completionRate: 0.6, replayRate: 0.1, impressions: 10000, clicks: 300, conversions: 30 },
        { id: 'e2', variantId: 'v2', platform: 'instagram', publishedAt: '2026-08-27T00:00:00Z', completionRate: 0.7, replayRate: 0.08, impressions: 10000, clicks: 400, conversions: 40 },
      ],
    );

    expect(pattern.repeatabilityScore).toBe(100);
    expect(pattern.confidence).toBeGreaterThan(0);
    expect(generateControlledVariants(pattern, 4)).toHaveLength(4);
  });

  it('bounds variant generation to a safe experimental range', () => {
    const pattern = discoverCreativePattern('test', {
      hook: 'h', opening: 'o', problem: 'p', proof: 'p', pacing: 'p',
      cta: 'c', format: 'f', audience: 'a', offer: 'o',
    }, []);
    expect(generateControlledVariants(pattern, 99)).toHaveLength(10);
    expect(generateControlledVariants(pattern, 0)).toHaveLength(1);
  });
});
