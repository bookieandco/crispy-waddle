import { describe, expect, it } from 'vitest';
import { applyLineageEvent, createLineageIndex } from './lineage-events.js';
import type { GrowthEvent } from '../events/event-contract.js';

const event = (eventType: GrowthEvent['eventType'], entityId: string, payload: unknown): GrowthEvent => ({
  eventId: `evt-${entityId}`,
  eventType,
  entityType: eventType,
  entityId,
  actor: 'test',
  source: 'test',
  payload,
  occurredAt: '2026-08-12T18:00:00.000Z',
  correlationId: 'corr-1',
  idempotencyKey: `key-${entityId}`,
});

describe('event-driven lineage index', () => {
  it('indexes assets under their creative concept', () => {
    const index = createLineageIndex();
    applyLineageEvent(index, event('asset_created', 'asset-1', { creativeConceptId: 'creative-1' }));

    expect([...index.creativeToAssets.get('creative-1')!]).toEqual(['asset-1']);
  });

  it('indexes campaign creatives', () => {
    const index = createLineageIndex();
    applyLineageEvent(index, event('campaign_created', 'campaign-1', { creativeIds: ['creative-1', 'creative-2'] }));

    expect([...index.creativeToCampaigns.get('creative-1')!]).toEqual(['campaign-1']);
    expect([...index.creativeToCampaigns.get('creative-2')!]).toEqual(['campaign-1']);
  });

  it('links a creative directly to its declared campaign', () => {
    const index = createLineageIndex();
    applyLineageEvent(index, event('creative_created', 'creative-1', { campaignId: 'campaign-1' }));

    expect([...index.creativeToCampaigns.get('creative-1')!]).toEqual(['campaign-1']);
  });
});
