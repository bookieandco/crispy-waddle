import { describe, expect, it } from 'vitest';
import { summarizeFunnel, type FunnelEvent } from './funnel-events.js';

describe('summarizeFunnel', () => {
  it('connects attention to revenue and refunds', () => {
    const events: FunnelEvent[] = [
      { eventId: '1', eventType: 'content_viewed', stage: 'discovery', occurredAt: '2026-08-27T00:00:00Z', source: 'tiktok' },
      { eventId: '2', eventType: 'content_clicked', stage: 'discovery', occurredAt: '2026-08-27T00:00:01Z', source: 'tiktok' },
      { eventId: '3', eventType: 'lead_created', stage: 'consideration', occurredAt: '2026-08-27T00:00:02Z', source: 'landing-page' },
      { eventId: '4', eventType: 'purchase_created', stage: 'conversion', occurredAt: '2026-08-27T00:00:03Z', source: 'stripe', value: 100, currency: 'USD' },
      { eventId: '5', eventType: 'refund_recorded', stage: 'conversion', occurredAt: '2026-08-27T00:00:04Z', source: 'stripe', value: 20, currency: 'USD' },
    ];
    expect(summarizeFunnel(events)).toMatchObject({ views: 1, clicks: 1, leads: 1, purchases: 1, refunds: 1, revenue: 80 });
  });
});
