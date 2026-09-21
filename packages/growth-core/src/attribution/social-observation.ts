import type { AttributionEvent } from "../domain/types.js";

export interface SocialAttributionObservation {
  id: string;
  contentId: string;
  platform: string;
  observedAt: string;
  metrics: Readonly<Record<string, number>>;
  source: string;
  confidence?: number;
}

export function socialObservationToAttributionEvents(
  observation: SocialAttributionObservation,
): AttributionEvent[] {
  const mappings: Array<[string, AttributionEvent["eventType"]]> = [
    ["impressions", "impression"],
    ["clicks", "click"],
    ["landingViews", "landing_view"],
    ["leads", "lead"],
    ["purchases", "purchase"],
  ];

  return mappings.flatMap(([metric, eventType]) => {
    const count = observation.metrics[metric];
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return [];
    return [{
      eventId: `social:${observation.id}:${metric}`,
      eventType,
      occurredAt: observation.observedAt,
      creativeId: observation.contentId,
      channelId: `social:${observation.platform}`,
      source: observation.source,
      confidence: Math.min(1, Math.max(0, observation.confidence ?? 0.5)),
    }];
  });
}
