export type OpportunityMatch = {
  eligible: boolean
  capabilityFit: number
  locationFit: number
  startupCostFit: number
  timeFit: number
  paymentLikelihood: number
  deadlineFit: number
  blockers: readonly string[]
  reasons: readonly string[]
}

export function isOpportunityPursuable(match: OpportunityMatch): boolean {
  return match.eligible && match.blockers.length === 0
}
