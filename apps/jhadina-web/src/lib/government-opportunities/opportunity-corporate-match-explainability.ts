import type { OpportunityCorporateMatch } from './opportunity-corporate-matching'

export interface OpportunityCorporateMatchExplanation {
  opportunityId: string
  companyEntityId: string
  score: number
  factors: {
    capabilityCoverage: number
    jurisdictionMatch: boolean
    sourceConfidence: number
  }
  matchedCapabilities: string[]
  evidenceIds: string[]
  limitations: string[]
}

/** Produces an auditable explanation for an opportunity/company match. */
export function explainOpportunityCorporateMatch(
  match: OpportunityCorporateMatch,
): OpportunityCorporateMatchExplanation {
  const limitations: string[] = []

  if (match.capabilityCoverage < 1) {
    limitations.push('Candidate does not cover every required capability.')
  }
  if (!match.jurisdictionMatch) {
    limitations.push('Candidate jurisdiction does not exactly match the opportunity jurisdiction.')
  }
  if (match.evidenceIds.length === 0) {
    limitations.push('No evidence IDs are attached; treat this as an unverified research signal.')
  }

  const sourceConfidence = match.capabilityCoverage === 0
    ? 0
    : Math.min(1, match.confidence / match.capabilityCoverage)

  return {
    opportunityId: match.opportunityId,
    companyEntityId: match.companyEntityId,
    score: match.confidence,
    factors: {
      capabilityCoverage: match.capabilityCoverage,
      jurisdictionMatch: match.jurisdictionMatch,
      sourceConfidence,
    },
    matchedCapabilities: [...match.matchedCapabilities].sort(),
    evidenceIds: [...new Set(match.evidenceIds)].sort(),
    limitations,
  }
}

export function explainOpportunityCorporateMatches(
  matches: OpportunityCorporateMatch[],
): OpportunityCorporateMatchExplanation[] {
  return matches.map(explainOpportunityCorporateMatch)
}
