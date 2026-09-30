export type ProblemMeasure = {
  id: string
  metric: string
  value: number
  unit?: string
  period: string
  sourceId: string
  confidence: number
}

export type Intervention = {
  id: string
  name: string
  targetMetrics: string[]
  mechanism: string
  evidenceIds: string[]
  status: "proposed" | "active" | "completed" | "unknown"
}

export type SolutionGap = {
  metric: string
  observedValue: number
  interventions: string[]
  gapType: "unaddressed" | "partially_addressed" | "addressed" | "insufficient_evidence"
  confidence: number
  reasons: string[]
}

/**
 * Compares measured problems with explicitly documented interventions.
 * It does not claim that an intervention works unless supporting evidence is
 * supplied by the caller.
 */
export function findSolutionGaps(
  measures: ProblemMeasure[],
  interventions: Intervention[],
): SolutionGap[] {
  const metrics = [...new Set(measures.map((measure) => measure.metric))]

  return metrics.map((metric) => {
    const relevantMeasures = measures.filter((measure) => measure.metric === metric)
    const relevantInterventions = interventions.filter((intervention) =>
      intervention.targetMetrics.includes(metric),
    )

    const observedValue = relevantMeasures.reduce((sum, measure) => sum + measure.value, 0) /
      Math.max(1, relevantMeasures.length)
    const measureConfidence = relevantMeasures.reduce((sum, measure) => sum + Math.max(0, Math.min(1, measure.confidence)), 0) /
      Math.max(1, relevantMeasures.length)

    const active = relevantInterventions.filter((item) => item.status === "active" || item.status === "completed")
    const hasEvidence = relevantInterventions.some((item) => item.evidenceIds.length > 0)

    const gapType: SolutionGap["gapType"] = !measureConfidence || relevantMeasures.length === 0
      ? "insufficient_evidence"
      : active.length === 0
        ? "unaddressed"
        : hasEvidence
          ? "partially_addressed"
          : "partially_addressed"

    return {
      metric,
      observedValue,
      interventions: relevantInterventions.map((item) => item.id),
      gapType,
      confidence: Math.min(1, measureConfidence),
      reasons: [
        `measures:${relevantMeasures.length}`,
        `interventions:${relevantInterventions.length}`,
        `documentedEvidence:${hasEvidence ? "yes" : "no"}`,
      ],
    }
  })
}
