import type { GrowthId } from '../domain/types.js';
import type { NormalizedAdvertisingEvent } from '../events/advertising-events.js';

export interface CustomerTouchpoint {
  touchpointId: GrowthId;
  customerId: GrowthId;
  occurredAt: string;
  type: 'session' | 'lead' | 'order';
  externalEventId?: string;
  revenue?: number;
  metadata: Record<string, unknown>;
}

export interface ResolvedAttributionPath {
  customerId: GrowthId;
  advertisingEventIds: GrowthId[];
  touchpointIds: GrowthId[];
  campaignId?: GrowthId;
  assetId?: GrowthId;
  creativeConceptId?: GrowthId;
  audienceId?: GrowthId;
  offerId?: GrowthId;
  revenue: number;
  resolution: 'resolved' | 'partial' | 'unresolved';
}

export function resolveAttributionPath(
  adEvents: readonly NormalizedAdvertisingEvent[],
  touchpoints: readonly CustomerTouchpoint[],
  maxTouchpointAgeMs = 7 * 24 * 60 * 60 * 1000,
): ResolvedAttributionPath[] {
  const results = new Map<GrowthId, ResolvedAttributionPath>();

  for (const touchpoint of touchpoints) {
    const candidates = adEvents.filter((event) => {
      const age = new Date(touchpoint.occurredAt).getTime() - new Date(event.occurredAt).getTime();
      return age >= 0 && age <= maxTouchpointAgeMs;
    });

    if (candidates.length === 0) continue;
    const ordered = [...candidates].sort((a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    const event = ordered[0];
    const existing = results.get(touchpoint.customerId);

    if (existing) {
      existing.advertisingEventIds.push(event.eventId);
      existing.touchpointIds.push(touchpoint.touchpointId);
      existing.revenue += touchpoint.revenue ?? 0;
      continue;
    }

    results.set(touchpoint.customerId, {
      customerId: touchpoint.customerId,
      advertisingEventIds: [event.eventId],
      touchpointIds: [touchpoint.touchpointId],
      campaignId: event.campaignId,
      assetId: event.assetId,
      creativeConceptId: event.creativeConceptId,
      audienceId: event.audienceId,
      offerId: event.offerId,
      revenue: touchpoint.revenue ?? 0,
      resolution: touchpoint.type === 'order' ? 'resolved' : 'partial',
    });
  }

  return [...results.values()];
}
