import type { Opportunity } from '../domain/opportunity.js'

export type SamOpportunityInput = {
  noticeId: string
  title: string
  noticeType?: string
  solicitationNumber?: string
  department?: string
  office?: string
  naicsCode?: string
  setAside?: string
  responseDeadline?: string
  estimatedValue?: number
  placeOfPerformance?: string
  description?: string
  sourceUrl: string
  fetchedAt?: string
}

export function adaptSamOpportunity(input: SamOpportunityInput): Opportunity {
  const now = input.fetchedAt ?? new Date().toISOString()
  const claims = [
    { id: `${input.noticeId}:title`, field: 'title', value: input.title, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true },
    ...(input.responseDeadline ? [{ id: `${input.noticeId}:deadline`, field: 'deadline', value: input.responseDeadline, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.estimatedValue !== undefined ? [{ id: `${input.noticeId}:amount`, field: 'amount.max', value: input.estimatedValue, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.naicsCode ? [{ id: `${input.noticeId}:naics`, field: 'eligibility.naicsCode', value: input.naicsCode, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.setAside ? [{ id: `${input.noticeId}:set-aside`, field: 'eligibility.setAside', value: input.setAside, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.placeOfPerformance ? [{ id: `${input.noticeId}:place`, field: 'eligibility.placeOfPerformance', value: input.placeOfPerformance, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.noticeType ? [{ id: `${input.noticeId}:notice-type`, field: 'noticeType', value: input.noticeType, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.solicitationNumber ? [{ id: `${input.noticeId}:solicitation`, field: 'solicitationNumber', value: input.solicitationNumber, sourceId: 'us.sam.gov', sourceType: 'official' as const, confidence: 1, verified: true }] : []),
  ]

  return {
    id: `sam:${input.noticeId}`,
    title: input.title,
    family: 'funding',
    type: 'contract',
    description: input.description,
    sourceUrl: input.sourceUrl,
    sourceName: 'SAM.gov Contract Opportunities',
    sourceId: 'us.sam.gov',
    amount: input.estimatedValue === undefined ? undefined : { max: input.estimatedValue, currency: 'USD' },
    deadline: input.responseDeadline,
    jurisdiction: { country: 'US' },
    eligibility: {
      naicsCode: input.naicsCode,
      setAside: input.setAside,
      placeOfPerformance: input.placeOfPerformance,
    },
    requirements: [
      ...(input.solicitationNumber ? [`solicitation:${input.solicitationNumber}`] : []),
      ...(input.noticeType ? [`noticeType:${input.noticeType}`] : []),
    ],
    claims,
    evidence: [{
      id: `${input.noticeId}:sam-source`,
      sourceId: 'us.sam.gov',
      sourceUrl: input.sourceUrl,
      sourceName: 'SAM.gov Contract Opportunities',
      sourceType: 'official',
      capturedAt: now,
      confidence: 1,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 1,
    riskFlags: ['human_verification_required'],
    brokerability: 'unknown',
    metadata: { providerId: 'provider:sam.gov', opportunityKind: 'automation', automationLevel: 'ai_plus_user', requiresUserApproval: true },
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
}
