import { describe, expect, it } from 'vitest';
import { attributeRevenue } from './attribution-model.js';
import type { ResolvedAttributionPath } from './event-resolution.js';

const path: ResolvedAttributionPath = {
  customerId: 'customer-1', advertisingEventIds: ['ad-1', 'ad-2'], touchpointIds: ['tp-1', 'tp-2'],
  campaignId: 'campaign-1', assetId: 'asset-1', creativeConceptId: 'creative-1', audienceId: 'audience-1', offerId: 'offer-1',
  revenue: 200, resolution: 'resolved',
};

describe('attribution models', () => {
  it('assigns all revenue to the first touch', () => {
    const credits = attributeRevenue([path], 'first_touch');
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ touchpointEventId: 'ad-1', attributedRevenue: 200 });
  });

  it('assigns all revenue to the last touch', () => {
    const credits = attributeRevenue([path], 'last_touch');
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ touchpointEventId: 'ad-2', attributedRevenue: 200 });
  });

  it('splits revenue evenly under linear attribution', () => {
    const credits = attributeRevenue([path], 'linear');
    expect(credits).toHaveLength(2);
    expect(credits[0].attributedRevenue).toBe(100);
    expect(credits[1].attributedRevenue).toBe(100);
  });
});
