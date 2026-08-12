export type PollRecord = {
  id: string
  pollster: string
  fieldStart: string
  fieldEnd: string
  geography: string
  sampleSize: number
  population: "likely_voters" | "registered_voters" | "adults" | "unknown"
  marginOfError?: number
  candidate?: string
  support?: number
  sourceUrl: string
}

export type PollTrend = {
  geography: string
  candidate: string
  averageSupport: number | null
  pollCount: number
  confidence: "low" | "medium" | "high"
  direction: "up" | "down" | "stable" | "insufficient_data"
  warning?: string
}

/**
 * CampaignOS polling intelligence is descriptive only.
 * It aggregates public poll observations and never creates targeted
 * persuasion instructions or automatically changes campaign actions.
 */
export function summarizePolls(polls: PollRecord[], candidate: string, geography: string): PollTrend {
  const relevant = polls.filter((p) => p.candidate === candidate && p.geography === geography && typeof p.support === "number")
  if (relevant.length === 0) {
    return { geography, candidate, averageSupport: null, pollCount: 0, confidence: "low", direction: "insufficient_data" }
  }

  const sorted = [...relevant].sort((a, b) => a.fieldEnd.localeCompare(b.fieldEnd))
  const weightedTotal = sorted.reduce((sum, p) => sum + (p.support ?? 0) * Math.max(p.sampleSize, 1), 0)
  const sampleTotal = sorted.reduce((sum, p) => sum + Math.max(p.sampleSize, 1), 0)
  const averageSupport = weightedTotal / sampleTotal

  const recent = sorted.slice(-3)
  const older = sorted.slice(0, Math.max(1, sorted.length - recent.length))
  const recentAvg = recent.reduce((s, p) => s + (p.support ?? 0), 0) / recent.length
  const olderAvg = older.reduce((s, p) => s + (p.support ?? 0), 0) / older.length
  const delta = recentAvg - olderAvg
  const direction = delta > 1 ? "up" : delta < -1 ? "down" : "stable"

  const confidence = sorted.length >= 8 ? "high" : sorted.length >= 4 ? "medium" : "low"

  return {
    geography,
    candidate,
    averageSupport,
    pollCount: sorted.length,
    confidence,
    direction,
    warning: sorted.length < 4 ? "Limited public polling; do not infer a durable trend from this sample." : undefined,
  }
}
