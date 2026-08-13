import { describe, expect, it } from 'vitest';
import { AdvertisingEventLedger, normalizeAdvertisingEvent } from './advertising-events.js';

describe('advertising event ledger', () => {
  it('normalizes optional metadata and preserves attribution lineage', () => {
    const event = normalizeAdvertisingEvent({
      eventId: 'event-1', occurredAt: '2026-08-12T18:00:00Z', channel: 'meta',
      eventType: 'impression', campaignId: 'campaign-1', externalCampaignId: 'meta:campaign-1',
      assetId: 'asset-1', creativeConceptId: 'creative-1', audienceId: 'audience-1', offerId: 'offer-1',
    });

    expect(event.metadata).toEqual({});
    expect(event.creativeConceptId).toBe('creative-1');
    expect(event.audienceId).toBe('audience-1');
  });

  it('rejects duplicate event IDs', () => {
    const ledger = new AdvertisingEventLedger();
    const event = normalizeAdvertisingEvent({
      eventId: 'event-1', occurredAt: '2026-08-12T18:00:00Z', channel: 'google',
      eventType: 'click', campaignId: 'campaign-1', externalCampaignId: 'google:campaign-1',
    });
    ledger.append(event);
    expect(() => ledger.append(event)).toThrow('Duplicate advertising event');
  });
});
