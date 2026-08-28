import { describe, expect, it } from 'vitest';
import { advertisingEventsToCreativeEvidence } from './creative-evidence-bridge.js';

describe('creative evidence bridge', () => {
  it('aggregates normalized advertising events by creative and platform', () => {
    const result = advertisingEventsToCreativeEvidence([
      {
        eventId: 'i1', occurredAt: '2026-08-27T00:00:00Z', channel: 'meta', eventType: 'impression',
        campaignId: 'c1', externalCampaignId: 'm1', creativeConceptId: 'creative-a', value: 1000, metadata: {},
      },
      {
        eventId: 'k1', occurredAt: '2026-08-27T00:01:00Z', channel: 'meta', eventType: 'click',
        campaignId: 'c1', externalCampaignId: 'm1', creativeConceptId: 'creative-a', value: 25, metadata: {},
      },
      {
        eventId: 'v1', occurredAt: '2026-08-27T00:02:00Z', channel: 'meta', eventType: 'conversion',
        campaignId: 'c1', externalCampaignId: 'm1', creativeConceptId: 'creative-a', value: 3,
        currency: 'USD', metadata: { revenue: 150 },
      },
    ]);

    expect(result).toEqual([expect.objectContaining({
      variantId: 'creative-a', platform: 'meta', impressions: 1000,
      clicks: 25, conversions: 3, revenue: 150,
    })]);
  });

  it('does not invent creative attribution when the event has no creative id', () => {
    const result = advertisingEventsToCreativeEvidence([{
      eventId: 'i1', occurredAt: '2026-08-27T00:00:00Z', channel: 'meta', eventType: 'impression',
      campaignId: 'c1', externalCampaignId: 'm1', value: 1000, metadata: {},
    }]);

    expect(result).toHaveLength(0);
  });
});
