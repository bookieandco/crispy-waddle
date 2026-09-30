export type EvidenceQuality = "very_low" | "low" | "moderate" | "high" | "very_high"

export type InterventionEvidence = {
  id: string
  interventionId: string
  outcomeMetric: string
  effectDirection: "positive" | "negative" | "mixed" | "null" | "unknown"
  effectSize?: number
  quality: EvidenceQuality
  population?: string
  geography?: string
  period?: string
  sourceId: string
}

export type InterventionCandidate = {
  id: string
  name: string
  targetMetrics: string[]
  estimatedCost?: number
  costUnit?: string
  implementationComplexity: "low" | "medium" | "high" | "unknown"
  evidenceIds: string[]
}

export type InterventionAssessment = {
  interventionId: string
  metric: string
  evidenceCount: number
  evidenceQuality: EvidenceQuality
  support: "supported" | "mixed" | "unsupported" | "insufficient_evidence"
  confidence: number
  caveats: string[]
}

const QUALITY_SCORE: Record<EvidenceQuality, number> = {
  very_low: 0.2,
  low: 0.35,
  moderate: 0.55,
  high: 0.75,
  very_high: 0.9,
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function evaluateIntervention(
  intervention: InterventionCandidate,
  metric: string,
  evidence: InterventionEvidence[],
): InterventionAssessment {
  const relevant = evidence.filter(
    (item) => item.interventionId === intervention.id && item.outcomeMetric === metric,
  )

  if (relevant.length === 0) {
    return {
      interventionId: intervention.id,
      metric,
      evidenceCount: 0,
      evidenceQuality: "very_low",
      support: "insufficient_evidence",
      confidence: 0,
      caveats: ["No outcome evidence was supplied for this metric."],
    }
  }

  const qualityScore = relevant.reduce((sum, item) => sum + QUALITY_SCORE[item.quality], 0) / relevant.length
  const positive = relevant.filter((item) => item.effectDirection === "positive").length
  const negative = relevant.filter((item) => item.effectDirection === "negative").length
  const mixed = relevant.some((item) => item.effectDirection === "mixed" || item.effectDirection === "unknown")
  const support = mixed || (positive > 0 && negative > 0)
    ? "mixed"
    : positive > 0
      ? "supported"
      : negative > 0
        ? "unsupported"
        : "insufficient_evidence"

  const confidence = clamp(qualityScore * Math.min(1, relevant.length / 3))
  const strongestQuality = [...relevant]
    .sort((a, b) => QUALITY_SCORE[b.quality] - QUALITY_SCORE[a.quality])[0].quality

  return {
    interventionId: intervention.id,
    metric,
    evidenceCount: relevant.length,
    evidenceQuality: strongestQuality,
    support,
    confidence,
    caveats: [
      "Effectiveness is evidence-dependent and context-specific.",
      ...(mixed ? ["Evidence is mixed or includes uncertain findings."] : []),
      ...(intervention.implementationComplexity === "unknown" ? ["Implementation complexity is unknown."] : []),
      ...(intervention.estimatedCost === undefined ? ["No cost estimate was supplied."] : []),
    ],
  }
}
