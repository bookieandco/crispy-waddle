export type PrincipalOpportunityDisposition =
  | 'PURSUE'
  | 'PRIORITIZE'
  | 'MONITOR'
  | 'PARTNER'
  | 'REVIEW'
  | 'PASS'

export interface PrincipalOpportunityRankingInput {
  opportunityId: string
  principalId: string
  relevanceScore: number
  relevance: 'DIRECT' | 'CORPORATE' | 'HISTORICAL' | 'INDIRECT' | 'NONE'
  opportunityStatus?: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  estimatedValue?: number
  agencyFit?: number
  naicsFit?: number
  pscFit?: number
  setAsideFit?: number
  priorAwardFit?: number
  competition?: number
  daysToDeadline?: number
  evidenceQuality?: number
}

export interface PrincipalOpportunityScore {
  opportunityId: string
  principalId: string
  principalRelevance: number
  value: number
  agencyFit: number
  naicsFit: number
  pscFit: number
  setAsideFit: number
  priorAwardFit: number
  competition: number
  timing: number
  evidenceQuality: number
  total: number
  disposition: PrincipalOpportunityDisposition
  reasons: string[]
}

export interface PrincipalOpportunityRankingProfile {
  minEstimatedValue?: number
  preferredAgencies?: string[]
  preferredNaics?: string[]
  preferredPsc?: string[]
  preferredSetAsides?: string[]
}

const ENGINE_VERSION = 'oce-6.73.0'

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

/**
 * Deterministic ranking of already-established opportunity/principal relationships.
 * This layer does not resolve identity, ownership, eligibility, or contact data.
 */
export function rankPrincipalOpportunity(
  input: PrincipalOpportunityRankingInput,
): PrincipalOpportunityScore {
  const relevance = clamp(input.relevanceScore)
  const value = input.estimatedValue == null
    ? 40
    : clamp((Math.log10(Math.max(1, input.estimatedValue)) / 7) * 100)
  const agencyFit = clamp(input.agencyFit ?? 50)
  const naicsFit = clamp(input.naicsFit ?? 50)
  const pscFit = clamp(input.pscFit ?? 50)
  const setAsideFit = clamp(input.setAsideFit ?? 50)
  const priorAwardFit = clamp(input.priorAwardFit ?? 40)
  const competition = clamp(input.competition ?? 50)
  const timing = scoreTiming(input.daysToDeadline)
  const evidenceQuality = clamp(input.evidenceQuality ?? 50)

  let total = clamp(
    relevance * 0.25 +
      value * 0.12 +
      agencyFit * 0.10 +
      naicsFit * 0.10 +
      pscFit * 0.06 +
      setAsideFit * 0.08 +
      priorAwardFit * 0.08 +
      competition * 0.06 +
      timing * 0.06 +
      evidenceQuality * 0.09,
  )

  const reasons: string[] = [`Score ${total}/100`, `principal relevance: ${relevance}/100`]

  if (input.opportunityStatus === 'INACTIVE') {
    total = Math.min(total, 35)
    reasons.push('opportunity is inactive')
  }

  if (input.relevance === 'NONE') {
    total = Math.min(total, 20)
    reasons.push('principal has no established relevance to this opportunity')
  } else if (input.relevance === 'DIRECT') {
    reasons.push('principal has direct relevance')
  } else if (input.relevance === 'HISTORICAL') {
    total = Math.min(total, 65)
    reasons.push('principal relationship is historical')
  }

  if (evidenceQuality < 50) reasons.push('evidence quality is below preferred threshold')
  if (competition >= 75) reasons.push('competition signal is favorable')
  if (priorAwardFit >= 75) reasons.push('prior award history is a strong fit')
  if (timing < 30) reasons.push('deadline timing is unfavorable or expired')

  total = clamp(total)

  let disposition: PrincipalOpportunityDisposition = 'PASS'
  if (total >= 80 && relevance >= 75 && evidenceQuality >= 70) disposition = 'PURSUE'
  else if (total >= 70 && relevance >= 55) disposition = 'PRIORITIZE'
  else if (total >= 55) disposition = 'MONITOR'
  else if (total >= 45 && relevance >= 35) disposition = 'PARTNER'
  else if (total >= 30) disposition = 'REVIEW'

  if (input.relevance === 'NONE' || input.opportunityStatus === 'INACTIVE') disposition = 'PASS'

  return {
    opportunityId: input.opportunityId,
    principalId: input.principalId,
    principalRelevance: relevance,
    value,
    agencyFit,
    naicsFit,
    pscFit,
    setAsideFit,
    priorAwardFit,
    competition,
    timing,
    evidenceQuality,
    total,
    disposition,
    reasons: [...reasons, `engine ${ENGINE_VERSION}`],
  }
}

export function rankPrincipalOpportunities(
  inputs: PrincipalOpportunityRankingInput[],
): PrincipalOpportunityScore[] {
  return inputs
    .map(rankPrincipalOpportunity)
    .sort((a, b) => b.total - a.total || b.principalRelevance - a.principalRelevance)
}

function scoreTiming(daysToDeadline?: number): number {
  if (daysToDeadline == null) return 50
  if (daysToDeadline < 0) return 0
  if (daysToDeadline <= 7) return 90
  if (daysToDeadline <= 30) return 80
  if (daysToDeadline <= 60) return 65
  if (daysToDeadline <= 120) return 50
  return 35
}
