import type { GrowthId } from '../domain/types.js';
import type { OrganicSocialEvent } from '../events/organic-social.js';

export interface OrganicCreativeSignals {
  creativeId?: GrowthId;
  experimentId?: GrowthId;
  platform: string;
  format?: string;
  hook?: string;
  metrics: Record<string, number>;
  evidenceEventIds: GrowthId[];
}

/**
 * Converts normalized organic-social observations into reusable, provenance-aware
 * creative signals. It deliberately does not decide whether a creative is a
 * winner; experiment-intelligence owns that decision.
 */
export function deriveOrganicCreativeSignals(
  event: OrganicSocialEvent,
): OrganicCreativeSignals {
  const { post, observations } = event.payload;
  const metrics: Record<string, number> = {};

  for (const observation of observations) {
    metrics[observation.metric] = observation.value;
  }

  return {
    creativeId: post.creativeId,
    experimentId: post.experimentId,
    platform: post.platform,
    format: post.format,
    hook: post.titleOrHook,
    metrics,
    evidenceEventIds: [event.eventId],
  };
}
