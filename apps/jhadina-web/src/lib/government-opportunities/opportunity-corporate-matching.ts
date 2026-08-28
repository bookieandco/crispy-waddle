export interface OpportunityCorporateMatchInput {
  opportunityId: string
  opportunityTitle: string
  agencyId?: string
  jurisdiction?: string
  requiredCapabilities: string[]
}

export interface CorporateCapabilityCandidate {
  companyEntityId: string
  capabilities: string[]
  jurisdiction?: string
  evidenceIds: string[]
  confidence: number
}

export interface OpportunityCorporateMatch {
  opportunityId: string
  companyEntityId: string
  matchedCapabilities: string[]
  capabilityCoverage: number
  jurisdictionMatch: boolean
  confidence: number
  evidenceIds: string[]
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/** Deterministic capability-to-opportunity matching; it does not imply eligibility. */
export function matchOpportunityToCorporateCandidates(
  opportunity: OpportunityCorporateMatchInput,
  candidates: CorporateCapabilityCandidate[],
): OpportunityCorporateMatch[] {
  const required = [...new Set(opportunity.requiredCapabilities.map(normalize).filter(Boolean))]

  return candidates
    .map((candidate) => {
      const capabilities = new Set(candidate.capabilities.map(normalize))
      const matchedCapabilities = required.filter((capability) => capabilities.has(capability))
      const capabilityCoverage = required.length === 0 ? 0 : matchedCapabilities.length / required.length
      const jurisdictionMatch = !opportunity.jurisdiction || !candidate.jurisdiction
        ? true
        : normalize(opportunity.jurisdiction) === normalize(candidate.jurisdiction)

      return {
        opportunityId: opportunity.opportunityId,
        companyEntityId: candidate.companyEntityId,
        matchedCapabilities,
        capabilityCoverage,
        jurisdictionMatch,
        confidence: Math.max(0, Math.min(1, candidate.confidence * capabilityCoverage * (jurisdictionMatch ? 1 : 0.5))),
        evidenceIds: [...new Set(candidate.evidenceIds)].sort(),
      }
    })
    .filter((match) => match.matchedCapabilities.length > 0)
    .sort((a, b) => b.confidence - a.confidence || a.companyEntityId.localeCompare(b.companyEntityId))
}
