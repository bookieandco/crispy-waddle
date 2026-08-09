export type TrendSource = "youtube" | "tiktok" | "instagram" | "facebook" | "web" | "internal"

export type TrendObservation = {
  source: TrendSource
  title: string
  url?: string
  observedAt: string
  signals: {
    hook?: string
    format?: string
    topic?: string
    visualPattern?: string
    pacing?: string
    engagement?: number
  }
  evidence?: string[]
}

export type InspirationIdea = {
  id: string
  title: string
  rationale: string
  sourceObservations: TrendObservation[]
  originalityRule: "INSPIRED_NOT_COPIED"
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  createdAt: string
}

/**
 * Converts observed trends into original creative experiments.
 * This layer deliberately does not scrape or publish: connectors provide
 * observations, while Jhadina turns patterns into proposals for approval.
 */
export function createInspirationIdea(observations: TrendObservation[], title: string, rationale: string): InspirationIdea {
  if (!observations.length) throw new Error("At least one trend observation is required")
  return {
    id: `inspiration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    rationale,
    sourceObservations: observations,
    originalityRule: "INSPIRED_NOT_COPIED",
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  }
}

export function summarizeTrend(observations: TrendObservation[]) {
  const patterns = observations.flatMap(o => [o.signals.hook, o.signals.format, o.signals.topic, o.signals.visualPattern, o.signals.pacing]).filter(Boolean) as string[]
  const counts = new Map<string, number>()
  for (const pattern of patterns) counts.set(pattern, (counts.get(pattern) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([pattern, count]) => ({ pattern, count }))
}
