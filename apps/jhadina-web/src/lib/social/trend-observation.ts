import type { SocialPlatform } from "@jhadina/social-core"
import type { TrendObservation, TrendSource } from "../growth/trendScout"
import { createSocialRepository } from "./repository"

const SOCIAL_SOURCE_PLATFORM: Partial<Record<TrendSource, SocialPlatform>> = {
  youtube: "youtube",
  tiktok: "tiktok",
  instagram: "instagram",
  facebook: "facebook",
  x: "x",
  reddit: "reddit",
  linkedin: "linkedin",
  threads: "threads",
  bluesky: "bluesky",
}

export async function persistSocialTrendObservations(
  userId: string,
  connector: string,
  observations: readonly TrendObservation[],
): Promise<number> {
  const repository = createSocialRepository()
  const social = observations.filter(
    (observation): observation is TrendObservation & { source: keyof typeof SOCIAL_SOURCE_PLATFORM } =>
      SOCIAL_SOURCE_PLATFORM[observation.source] !== undefined,
  )

  await Promise.all(social.map((observation) => {
    const platform = SOCIAL_SOURCE_PLATFORM[observation.source]
    if (!platform) return Promise.resolve(null)

    const metrics = typeof observation.signals.engagement === "number"
      ? { engagements: observation.signals.engagement }
      : {}
    const attributes: Record<string, string | number | boolean | null> = {
      title: observation.title,
    }
    for (const [key, value] of Object.entries(observation.signals)) {
      if (value !== undefined) attributes[key] = value
    }

    return repository.recordObservation({
      userId,
      observation: {
        kind: "trend",
        source: connector,
        platform,
        observedAt: observation.observedAt,
        sourceUrl: observation.url,
        evidence: [observation.title, ...(observation.evidence ?? [])],
        metrics,
        attributes,
      },
    })
  }))

  return social.length
}
