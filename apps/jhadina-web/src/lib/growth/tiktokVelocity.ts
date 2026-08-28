import type { TrendObservation } from "./trendScout"

export type TikTokVelocityScore = {
  score: number
  sampleSize: number
  averageEngagement: number
  confidence: "low" | "medium" | "high"
  rationale: string[]
}

/**
 * Scores a TikTok observation set for experimentation priority.
 * This is deliberately heuristic: it ranks candidates; it does not claim
 * causal performance or predict virality.
 */
export function scoreTikTokVelocity(observations: TrendObservation[]): TikTokVelocityScore {
  if (!observations.length) {
    return { score: 0, sampleSize: 0, averageEngagement: 0, confidence: "low", rationale: ["No observations"] }
  }

  const engagements = observations
    .map(o => o.signals.engagement)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  const averageEngagement = engagements.length
    ? engagements.reduce((sum, value) => sum + value, 0) / engagements.length
    : 0

  const topicCount = new Set(observations.map(o => o.signals.topic).filter(Boolean)).size
  const formatCount = new Set(observations.map(o => o.signals.format).filter(Boolean)).size
  const sampleScore = Math.min(observations.length / 20, 1) * 25
  const engagementScore = Math.min(averageEngagement / 100000, 1) * 55
  const patternScore = (topicCount > 0 ? 10 : 0) + (formatCount > 0 ? 10 : 0)
  const score = Math.round(Math.min(100, sampleScore + engagementScore + patternScore))

  const confidence = observations.length >= 20 ? "high" : observations.length >= 8 ? "medium" : "low"
  return {
    score,
    sampleSize: observations.length,
    averageEngagement,
    confidence,
    rationale: [
      `${observations.length} observations collected`,
      `${engagements.length} observations contained numeric engagement`,
      topicCount ? `${topicCount} topic signal(s)` : "No normalized topic signal",
      formatCount ? `${formatCount} format signal(s)` : "No normalized format signal",
    ],
  }
}
