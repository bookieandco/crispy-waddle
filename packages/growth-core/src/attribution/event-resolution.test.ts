import { describe, expect, it } from 'vitest';
import { resolveAttributionPath } from './event-resolution.js';
import type { NormalizedAdvertisingEvent } from '../events/advertising-events.js';

const adEvent: NormalizedAdvertisingEvent = {
  eventId: 'ad-1', occurredAt: '2026-08-10T10:00:00Z', channel: 'meta', eventType: 'click',
  campaignId: 'campaign-1', externalCampaignId: 'meta:campaign-1', assetId: 'asset-1',
  creativeConceptId: 'creative-1', audienceId: 'audience-1', offerId: 'offer-1', metadata: {},
};

describe('attribution event resolution', () => {
  it('links a customer order to the most recent eligible advertising touchpoint', () => {
    const result = resolveAttributionPath([adEvent], [{
      touchpointId: 'order-touchpoint-1', customerId: 'customer-1', occurredAt: '2026-08-11T10:00:00Z',
      type: 'order', externalEventId: 'order-1', revenue: 250, metadata: {},
    }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      customerId: 'customer-1', campaignId: 'campaign-1', assetId: 'asset-1',
      creativeConceptId: 'creative-1', audienceId: 'audience-1', offerId: 'offer-1',
      revenue: 250, resolution: 'resolved',
    });
  });

  it('does not attribute events outside the lookback window', () => {
    const result = resolveAttributionPath([adEvent], [{
      touchpointId: 'order-touchpoint-2', customerId: 'customer-2', occurredAt: '2026-08-20T10:00:00Z',
      type: 'order', revenue: 100, metadata: {},
    }]);
    expect(result).toEqual([]);
  });
});
