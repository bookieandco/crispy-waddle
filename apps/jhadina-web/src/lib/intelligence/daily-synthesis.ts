import type { IntelligenceDomain } from "./source-registry"
import type { TemporalTrend } from "./temporal"

export type DailySynthesisSignal = {
  id: string
  domain: IntelligenceDomain
  title: string
  summary: string
  trend: TemporalTrend
  relevanceScore: number
  confidence: number
  corroboration: "none" | "weak" | "moderate" | "strong"
  evidenceIds: string[]
  recommendedAction?: string
}

export type DailySynthesis = {
  generatedAt: string
  headline: string
  verified: DailySynthesisSignal[]
  developing: DailySynthesisSignal[]
  watch: DailySynthesisSignal[]
  actions: DailySynthesisSignal[]
}

/**
 * Deterministic presentation layer. An LLM can later summarize this structure,
 * but it cannot invent evidence or silently change confidence levels.
 */
export function buildDailySynthesis(
  signals: DailySynthesisSignal[],
  now = new Date(),
): DailySynthesis {
  const ranked = [...signals].sort(
    (a, b) =>
      b.relevanceScore * b.confidence - a.relevanceScore * a.confidence,
  )

  const verified = ranked.filter(
    (signal) => signal.confidence >= 0.75 && signal.corroboration !== "none",
  )
  const developing = ranked.filter(
    (signal) => !verified.includes(signal) && signal.confidence >= 0.45,
  )
  const watch = ranked.filter(
    (signal) => !verified.includes(signal) && !developing.includes(signal),
  )
  const actions = ranked.filter((signal) => signal.recommendedAction && signal.relevanceScore >= 65)

  const headline = ranked.length === 0
    ? "No material intelligence changes detected."
    : `${ranked.length} material signals detected; ${verified.length} are corroborated.`

  return {
    generatedAt: now.toISOString(),
    headline,
    verified,
    developing,
    watch,
    actions,
  }
}
