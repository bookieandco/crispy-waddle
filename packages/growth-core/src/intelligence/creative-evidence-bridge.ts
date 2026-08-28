import type { GrowthId } from '../domain/types.js';
import type { NormalizedAdvertisingEvent } from '../events/advertising-events.js';
import type { CreativePerformanceEvidence } from './creative-format-intelligence.js';

export interface CreativeEvidenceAccumulator {
  variantId: GrowthId;
  platform: string;
  publishedAt: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

/**
 * Converts normalized advertising events into the evidence shape consumed by
 * Creative Format Intelligence. Events without a creative identifier are
 * intentionally ignored so attribution cannot be guessed.
 */
export function advertisingEventsToCreativeEvidence(
  events: readonly NormalizedAdvertisingEvent[],
): CreativePerformanceEvidence[] {
  const buckets = new Map<string, CreativeEvidenceAccumulator>();

  for (const event of events) {
    const variantId = event.assetId ?? event.creativeConceptId;
    if (!variantId) continue;

    const key = `${event.channel}:${variantId}`;
    const current = buckets.get(key) ?? {
      variantId,
      platform: event.channel,
      publishedAt: event.occurredAt,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    };

    if (event.eventType === 'impression') current.impressions += event.value ?? 1;
    if (event.eventType === 'click') current.clicks += event.value ?? 1;
    if (event.eventType === 'conversion') current.conversions += event.value ?? 1;
    if (event.eventType === 'conversion' && event.currency) current.revenue += event.metadata.revenue === 'number'
      ? event.metadata.revenue
      : 0;

    buckets.set(key, current);
  }

  return [...buckets.values()].map((bucket, index) => ({
    id: `creative-evidence:${bucket.platform}:${bucket.variantId}:${index}`,
    variantId: bucket.variantId,
    platform: bucket.platform,
    publishedAt: bucket.publishedAt,
    impressions: bucket.impressions,
    clicks: bucket.clicks,
    conversions: bucket.conversions,
    revenue: bucket.revenue,
  }));
}
