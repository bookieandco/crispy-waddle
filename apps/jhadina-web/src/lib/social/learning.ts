import {
  performanceObservationToCreativeEvents,
  performanceObservationToCreativeSignal,
  type SocialObservation,
  type SocialPerformanceObservation,
} from "@jhadina/social-core"
import { socialObservationToAttributionEvents } from "@jhadina/growth-core"

export function buildSocialLearningProjection(observation: SocialObservation) {
  if (
    observation.kind !== "performance" ||
    !observation.contentId ||
    !observation.metrics
  ) {
    return null
  }

  const performance: SocialPerformanceObservation = {
    ...observation,
    kind: "performance",
    contentId: observation.contentId,
    metrics: observation.metrics,
  }

  return {
    creativeSignal: performanceObservationToCreativeSignal(performance),
    creativeEvents: performanceObservationToCreativeEvents(performance),
    attributionEvents: socialObservationToAttributionEvents({
      id: performance.id,
      contentId: performance.contentId,
      platform: performance.platform,
      observedAt: performance.observedAt,
      metrics: performance.metrics,
      source: performance.source,
      confidence: typeof performance.attributes?.confidence === "number"
        ? performance.attributes.confidence
        : 0.5,
    }),
  }
}
