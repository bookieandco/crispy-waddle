import { describe, expect, it } from 'vitest';
import { runContentGrowthLoop } from './content-growth-loop.js';

describe('runContentGrowthLoop', () => {
  it('keeps content assessment, funnel economics, and growth intelligence together', () => {
    const result = runContentGrowthLoop({
      content: [
        {
          assetId: 'asset:winning',
          platform: 'tiktok',
          impressions: 10_000,
          views: 9_000,
          completionRate: 0.6,
          ctr: 0.025,
          saves: 500,
          leads: 100,
          purchases: 20,
          spend: 100,
          revenue: 600,
        },
        {
          assetId: 'asset:small',
          platform: 'instagram',
          impressions: 300,
          views: 250,
          completionRate: 0.1,
          ctr: 0.005,
        },
      ],
      funnelEvents: [
        { eventId: 'event:1', eventType: 'content_viewed', stage: 'discovery', occurredAt: '2026-08-27T00:00:00Z', source: 'tiktok' },
        { eventId: 'event:2', eventType: 'lead_created', stage: 'consideration', occurredAt: '2026-08-27T00:00:01Z', source: 'landing-page' },
        { eventId: 'event:3', eventType: 'purchase_created', stage: 'conversion', occurredAt: '2026-08-27T00:00:02Z', source: 'stripe', value: 100, currency: 'USD' },
        { eventId: 'event:4', eventType: 'refund_recorded', stage: 'conversion', occurredAt: '2026-08-27T00:00:03Z', source: 'stripe', value: 20, currency: 'USD' },
      ],
      aggregates: [],
    });

    expect(result.assessments.map((item) => item.verdict)).toEqual(['scale', 'hold']);
    expect(result.funnel).toMatchObject({ views: 1, leads: 1, purchases: 1, refunds: 1, revenue: 80 });
    expect(result.actions[0]?.assetId).toBe('asset:winning');
    expect(result.actions[0]?.action).toBe('scale');
  });
});
