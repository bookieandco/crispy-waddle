import type { EvidenceQuality } from "./intervention-evaluation"

export type RankedIntervention = {
  interventionId: string
  impactScore: number
  evidenceScore: number
  costScore: number
  complexityScore: number
  uncertaintyPenalty: number
  overallScore: number
  reasons: string[]
}

export type InterventionRankingInput = {
  interventionId: string
  expectedImpact?: number
  evidenceQuality: EvidenceQuality
  estimatedCost?: number
  implementationComplexity: "low" | "medium" | "high" | "unknown"
  confidence: number
}

const evidence: Record<EvidenceQuality, number> = {
  very_low: 20,
  low: 40,
  moderate: 60,
  high: 80,
  very_high: 95,
}

const complexity: Record<InterventionRankingInput["implementationComplexity"], number> = {
  low: 90,
  medium: 65,
  high: 40,
  unknown: 25,
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

/**
 * Transparent decision-support ranking. It does not select or execute policy;
 * callers should present the score and underlying evidence for human review.
 */
export function rankInterventions(
  inputs: InterventionRankingInput[],
): RankedIntervention[] {
  const costs = inputs.filter((item) => item.estimatedCost !== undefined).map((item) => item.estimatedCost!)
  const maxCost = Math.max(1, ...costs)

  return inputs
    .map((item) => {
      const impactScore = clamp(item.expectedImpact ?? 50)
      const evidenceScore = evidence[item.evidenceQuality]
      const costScore = item.estimatedCost === undefined
        ? 50
        : clamp(100 - (item.estimatedCost / maxCost) * 100)
      const complexityScore = complexity[item.implementationComplexity]
      const uncertaintyPenalty = clamp((1 - item.confidence) * 30)
      const overallScore = clamp(
        impactScore * 0.35 +
          evidenceScore * 0.30 +
          costScore * 0.15 +
          complexityScore * 0.20 -
          uncertaintyPenalty,
      )

      return {
        interventionId: item.interventionId,
        impactScore,
        evidenceScore,
        costScore,
        complexityScore,
        uncertaintyPenalty,
        overallScore,
        reasons: [
          `impact:${Math.round(impactScore)}`,
          `evidence:${item.evidenceQuality}`,
          `cost:${item.estimatedCost === undefined ? "unknown" : Math.round(item.estimatedCost)}`,
          `complexity:${item.implementationComplexity}`,
          `confidence:${item.confidence.toFixed(2)}`,
        ],
      }
    })
    .sort((a, b) => b.overallScore - a.overallScore)
}
