export type OpportunityScore = {
  demand: number
  buyerValue: number
  distributionPotential: number
  aiLeverage: number
  recurringRevenue: number
  competition: number
  startupCost: number
  operationalComplexity: number
  regulatoryRisk: number
  evidenceConfidence: number
  personalFit: number
  total: number
}

export type OpportunityScoreInput = Omit<OpportunityScore, 'total'>

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function calculateOpportunityScore(input: OpportunityScoreInput): OpportunityScore {
  const positive =
    input.demand +
    input.buyerValue +
    input.distributionPotential +
    input.aiLeverage +
    input.recurringRevenue +
    input.evidenceConfidence +
    input.personalFit
  const negative =
    input.competition +
    input.startupCost +
    input.operationalComplexity +
    input.regulatoryRisk

  return {
    ...input,
    total: clamp((positive / 7) - (negative / 4)),
  }
}
