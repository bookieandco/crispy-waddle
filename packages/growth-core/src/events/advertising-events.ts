import type { GrowthId } from '../domain/types.js';

export type AdvertisingEventType =
  | 'campaign_created'
  | 'impression'
  | 'click'
  | 'spend'
  | 'conversion'
  | 'campaign_paused';

export interface NormalizedAdvertisingEvent {
  eventId: GrowthId;
  occurredAt: string;
  channel: 'meta' | 'google' | 'x' | 'amazon' | 'ctv';
  eventType: AdvertisingEventType;
  campaignId: GrowthId;
  externalCampaignId: string;
  externalEventId?: string;
  assetId?: GrowthId;
  creativeConceptId?: GrowthId;
  audienceId?: GrowthId;
  offerId?: GrowthId;
  currency?: string;
  value?: number;
  metadata: Record<string, unknown>;
}

export function normalizeAdvertisingEvent(
  input: Omit<NormalizedAdvertisingEvent, 'metadata'> & { metadata?: Record<string, unknown> },
): NormalizedAdvertisingEvent {
  return {
    ...input,
    metadata: { ...(input.metadata ?? {}) },
  };
}

export class AdvertisingEventLedger {
  private readonly events = new Map<GrowthId, NormalizedAdvertisingEvent>();

  append(event: NormalizedAdvertisingEvent): void {
    if (this.events.has(event.eventId)) throw new Error(`Duplicate advertising event ${event.eventId}`);
    this.events.set(event.eventId, { ...event, metadata: { ...event.metadata } });
  }

  list(): NormalizedAdvertisingEvent[] {
    return [...this.events.values()].map((event) => ({ ...event, metadata: { ...event.metadata } }));
  }
}
