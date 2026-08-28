export type OpportunityRankingInput = {
  opportunityId: string
  demandGapScore: number
  providerMatchScore: number
  evidenceConfidence: number
  actionConfidence: number
  expectedValue: number
  riskScore: number
  effortScore: number
  capitalRequired: number
}

export type OpportunityRanking = OpportunityRankingInput & {
  priorityScore: number
  tier: 'P1' | 'P2' | 'P3' | 'WATCH'
  reasons: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Deterministic portfolio ranking. Monetary inputs are normalized by the
 * caller so this boundary remains independent of geography/currency.
 */
export function rankOpportunity(input: OpportunityRankingInput): OpportunityRanking {
  const demand = clamp(input.demandGapScore)
  const provider = clamp(input.providerMatchScore)
  const evidence = clamp(input.evidenceConfidence)
  const action = clamp(input.actionConfidence)
  const risk = clamp(input.riskScore)
  const effort = clamp(input.effortScore)
  const capital = clamp(input.capitalRequired)

  const priorityScore = Math.round(
    demand * 0.20 +
      provider * 0.15 +
      evidence * 0.15 +
      action * 0.10 +
      clamp(input.expectedValue) * 0.25 +
      (100 - risk) * 0.10 +
      (100 - effort) * 0.03 +
      (100 - capital) * 0.02,
  )

  const reasons: string[] = []
  if (demand >= 70) reasons.push('strong demand gap')
  if (provider >= 70) reasons.push('strong provider/fulfillment match')
  if (evidence >= 80) reasons.push('well-supported evidence')
  if (action >= 70) reasons.push('clear next action')
  if (input.expectedValue >= 70) reasons.push('high normalized expected value')
  if (risk <= 30) reasons.push('low modeled risk')

  const tier = priorityScore >= 80 ? 'P1' : priorityScore >= 65 ? 'P2' : priorityScore >= 45 ? 'P3' : 'WATCH'

  return { ...input, priorityScore, tier, reasons }
}

export function rankOpportunityPortfolio(inputs: OpportunityRankingInput[]): OpportunityRanking[] {
  return inputs
    .map(rankOpportunity)
    .sort((a, b) => b.priorityScore - a.priorityScore)
}
