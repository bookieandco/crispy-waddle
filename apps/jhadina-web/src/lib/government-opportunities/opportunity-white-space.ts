export interface WhiteSpaceInput {
  opportunityId: string
  requiredCapabilities: string[]
  visibleCandidateCompanyIds: string[]
  evidenceCount: number
  confidence: number
}

export interface WhiteSpaceSignal {
  opportunityId: string
  demandSignal: number
  supplierCoverage: number
  whiteSpaceScore: number
  candidateCompanyIds: string[]
  rationale: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Identifies research white-space where demand appears stronger than visible
 * supplier coverage. This is a discovery signal, not an eligibility or award prediction.
 */
export function scoreOpportunityWhiteSpace(input: WhiteSpaceInput): WhiteSpaceSignal {
  const requiredCount = new Set(input.requiredCapabilities.map((x) => x.trim().toLowerCase()).filter(Boolean)).size
  const supplierCount = new Set(input.visibleCandidateCompanyIds).size

  const demandSignal = clamp(
    0.5 + (requiredCount > 0 ? Math.min(requiredCount, 5) / 10 : 0) + Math.min(input.evidenceCount, 5) / 20,
  ) * clamp(input.confidence)

  const supplierCoverage = clamp(supplierCount / Math.max(1, requiredCount * 2))
  const whiteSpaceScore = clamp(demandSignal * (1 - supplierCoverage))

  const rationale: string[] = []
  if (demandSignal >= 0.6) rationale.push('Strong evidence-backed demand signal.')
  if (supplierCoverage <= 0.25) rationale.push('Low visible supplier coverage.')
  if (requiredCount >= 3) rationale.push('Opportunity spans multiple required capabilities.')
  if (input.evidenceCount < 2) rationale.push('Limited evidence depth; research before action.')
  if (rationale.length === 0) rationale.push('Moderate white-space signal; additional research recommended.')

  return {
    opportunityId: input.opportunityId,
    demandSignal,
    supplierCoverage,
    whiteSpaceScore,
    candidateCompanyIds: [...new Set(input.visibleCandidateCompanyIds)].sort(),
    rationale,
  }
}
