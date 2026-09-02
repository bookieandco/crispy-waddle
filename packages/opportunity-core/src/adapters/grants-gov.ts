import type { Opportunity } from '../domain/opportunity.js'

export type GrantsGovOpportunityInput = {
  opportunityId: string
  opportunityNumber?: string
  opportunityTitle: string
  agencyName?: string
  agencyCode?: string
  topLevelAgencyName?: string
  postDate?: string
  closeDate?: string
  opportunityStatus?: string
  fundingInstrument?: string
  fundingCategory?: string
  awardFloor?: number
  awardCeiling?: number
  estimatedTotalProgramFunding?: number
  expectedNumberOfAwards?: number
  applicantTypes?: string[]
  summary?: string
  opportunityUrl?: string
  capturedAt?: string
}

function normalizedType(value?: string): Opportunity['type'] {
  const normalized = value?.toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'cooperative_agreement') return 'grant'
  if (normalized === 'grant') return 'grant'
  return 'other'
}

function opportunityStatus(value?: string): Opportunity['status'] {
  const normalized = value?.toLowerCase()
  if (normalized === 'posted' || normalized === 'forecasted') return 'research_pending'
  if (normalized === 'closed' || normalized === 'archived') return 'expired'
  return 'research_pending'
}

function numberOrUndefined(value?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function adaptGrantsGovOpportunity(input: GrantsGovOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const sourceId = 'us.grants.gov'
  const sourceName = 'Grants.gov'
  const sourceUrl = input.opportunityUrl || `https://simpler.grants.gov/opportunity/${encodeURIComponent(input.opportunityId)}`
  const claims = [
    { id: `${input.opportunityId}:title`, field: 'title', value: input.opportunityTitle, sourceId, sourceType: 'official' as const, confidence: 1, verified: true },
    ...(input.opportunityNumber ? [{ id: `${input.opportunityId}:number`, field: 'opportunityNumber', value: input.opportunityNumber, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.agencyName ? [{ id: `${input.opportunityId}:agency`, field: 'agency', value: input.agencyName, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.closeDate ? [{ id: `${input.opportunityId}:deadline`, field: 'deadline', value: input.closeDate, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.awardCeiling !== undefined ? [{ id: `${input.opportunityId}:award-ceiling`, field: 'amount.max', value: input.awardCeiling, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
  ]

  const min = numberOrUndefined(input.awardFloor)
  const max = numberOrUndefined(input.awardCeiling)

  return {
    id: `grants:${input.opportunityId}`,
    title: input.opportunityTitle,
    family: 'funding',
    type: normalizedType(input.fundingInstrument),
    description: input.summary,
    sourceUrl,
    sourceName,
    sourceId,
    amount: min === undefined && max === undefined ? undefined : { min, max, currency: 'USD' },
    deadline: input.closeDate,
    jurisdiction: { country: 'US' },
    eligibility: {
      applicantTypes: input.applicantTypes,
      agency: input.agencyName,
      agencyCode: input.agencyCode,
      topLevelAgency: input.topLevelAgencyName,
      fundingCategory: input.fundingCategory,
    },
    requirements: [
      ...(input.opportunityNumber ? [`opportunityNumber:${input.opportunityNumber}`] : []),
      ...(input.fundingInstrument ? [`fundingInstrument:${input.fundingInstrument}`] : []),
      ...(input.opportunityStatus ? [`opportunityStatus:${input.opportunityStatus}`] : []),
    ],
    claims,
    evidence: [{
      id: `${input.opportunityId}:grants-source`,
      sourceId,
      sourceUrl,
      sourceName,
      sourceType: 'official',
      capturedAt: now,
      excerpt: input.summary,
      confidence: 1,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 1,
    riskFlags: ['human_verification_required'],
    brokerability: 'unknown',
    status: opportunityStatus(input.opportunityStatus),
    createdAt: now,
    updatedAt: now,
  }
}
