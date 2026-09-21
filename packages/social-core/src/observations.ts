import type {
  CreativePerformanceEvent,
  CreativeSignal,
} from "./creativeSignals.js";
import type { JhadinaBrand, SocialPlatform, SocialProviderName } from "./types.js";

export type SocialObservationKind =
  | "profile"
  | "trend"
  | "delivery"
  | "performance"
  | "engagement";

export interface SocialObservation {
  id: string;
  userId?: string;
  brand?: JhadinaBrand;
  kind: SocialObservationKind;
  source: string;
  provider?: SocialProviderName;
  platform: SocialPlatform;
  accountId?: string;
  providerProfileId?: string;
  contentId?: string;
  observedAt: string;
  sourceUrl?: string;
  evidence: readonly string[];
  metrics?: Readonly<Record<string, number>>;
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SocialPerformanceObservation extends SocialObservation {
  kind: "performance";
  contentId: string;
  metrics: Readonly<Record<string, number>>;
}

export function performanceObservationToCreativeSignal(
  observation: SocialPerformanceObservation,
): CreativeSignal {
  return {
    id: `creative-signal:${observation.id}`,
    source: "social",
    contentId: observation.contentId,
    platform: observation.platform,
    accountId: observation.accountId,
    observedAt: observation.observedAt,
    metrics: { ...observation.metrics },
    attributes: observation.attributes ? { ...observation.attributes } : undefined,
  };
}

export function performanceObservationToCreativeEvents(
  observation: SocialPerformanceObservation,
): CreativePerformanceEvent[] {
  const eventTypes: Array<[keyof typeof observation.metrics, CreativePerformanceEvent["type"]]> = [
    ["impressions", "impression"],
    ["views", "view"],
    ["engagements", "engagement"],
    ["clicks", "click"],
    ["leads", "lead"],
    ["conversions", "conversion"],
    ["purchases", "purchase"],
    ["refunds", "refund"],
  ];

  return eventTypes.flatMap(([metric, type]) => {
    const value = observation.metrics[String(metric)];
    if (typeof value !== "number" || !Number.isFinite(value)) return [];
    return [{
      id: `creative-event:${observation.id}:${String(metric)}`,
      type,
      occurredAt: observation.observedAt,
      source: "social" as const,
      contentId: observation.contentId,
      platform: observation.platform,
      accountId: observation.accountId,
      value,
      metadata: { observationId: observation.id },
    }];
  });
}
