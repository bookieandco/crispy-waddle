import type { SocialObservation } from "./observations.js";
import type { JhadinaBrand } from "./types.js";
import type { RelayTrend } from "./relay-workbench.js";

/**
 * Admission bridge for existing Social observations. It never polls a provider,
 * invents popularity, authorizes publishing, or learns from a foreign owner.
 * "authorized_observation" requires a separate trusted upstream admission ID.
 */
export function socialObservationsToRelayTrends(input: {
  observations: readonly SocialObservation[];
  ownerUserId: string;
  brand: JhadinaBrand;
  now: string;
  authorizedObservationIds: ReadonlySet<string>;
  limit?: number;
}): readonly RelayTrend[] {
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error("SOCIAL_TREND_TIME_INVALID");
  const limit = Math.min(30, Math.max(0, input.limit ?? 15));
  const ids = new Set<string>();
  const result: RelayTrend[] = [];
  for (const observation of input.observations) {
    if (result.length >= limit) break;
    if (observation.kind !== "trend" || observation.userId !== input.ownerUserId ||
        observation.brand !== input.brand || ids.has(observation.id) ||
        !observation.evidence?.length || !observation.sourceUrl) continue;
    const observed = Date.parse(observation.observedAt);
    if (!Number.isFinite(observed) || observed > now) continue;
    const attrs = observation.attributes;
    const topic = attrs?.topic;
    const pattern = attrs?.pattern;
    const format = attrs?.format;
    if (typeof topic !== "string" || !topic.trim() ||
        typeof pattern !== "string" || !pattern.trim() ||
        (format !== "short_video" && format !== "carousel")) continue;
    let safe = false;
    try {
      const url = new URL(observation.sourceUrl);
      safe = ["https:", "http:"].includes(url.protocol) &&
        !!url.hostname.includes(".") && !url.username && !url.password;
    } catch { /* reject */ }
    if (!safe) continue;
    ids.add(observation.id);
    result.push({
      id: "social-observation:" + observation.id,
      platform: observation.platform, format,
      topic, pattern, sourceUrl: observation.sourceUrl,
      observedAt: observation.observedAt,
      evidenceRefs: [...observation.evidence, "observation:" + observation.id],
      source: input.authorizedObservationIds.has(observation.id)
        ? "authorized_observation" : "owner_submitted",
    });
  }
  return Object.freeze(result);
}
