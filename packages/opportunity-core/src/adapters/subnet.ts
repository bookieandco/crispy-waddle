import type { Opportunity } from '../domain/opportunity.js'

export type SubnetOpportunityInput = {
  externalId: string
  title: string
  primeName: string
  description?: string
  closingDate?: string
  performanceStartDate?: string
  placeOfPerformance?: string
  naicsCode?: string
  naicsLabel?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  sourceUrl: string
  capturedAt?: string
}

export function adaptSubnetOpportunity(input: SubnetOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const sourceId = 'us.sba.subnet'
  const claims = [
    { id: `${input.externalId}:title`, field: 'title', value: input.title, sourceId, sourceType: 'official' as const, confidence: 1, verified: true },
    { id: `${input.externalId}:prime`, field: 'metadata.primeName', value: input.primeName, sourceId, sourceType: 'official' as const, confidence: 1, verified: true },
    ...(input.closingDate ? [{ id: `${input.externalId}:deadline`, field: 'deadline', value: input.closingDate, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.placeOfPerformance ? [{ id: `${input.externalId}:place`, field: 'eligibility.placeOfPerformance', value: input.placeOfPerformance, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
    ...(input.naicsCode ? [{ id: `${input.externalId}:naics`, field: 'eligibility.naicsCode', value: input.naicsCode, sourceId, sourceType: 'official' as const, confidence: 1, verified: true }] : []),
  ]

  return {
    id: `subnet:${input.externalId}`,
    title: input.title,
    family: 'business',
    type: 'contract',
    description: input.description,
    sourceUrl: input.sourceUrl,
    sourceName: 'SBA SUBNet',
    sourceId,
    deadline: input.closingDate,
    jurisdiction: { country: 'US', region: input.placeOfPerformance },
    eligibility: {
      naicsCode: input.naicsCode,
      naicsLabel: input.naicsLabel,
      placeOfPerformance: input.placeOfPerformance,
    },
    requirements: [
      ...(input.naicsCode ? [`naics:${input.naicsCode}`] : []),
      ...(input.performanceStartDate ? [`performanceStart:${input.performanceStartDate}`] : []),
    ],
    claims,
    evidence: [{
      id: `${input.externalId}:subnet-source`,
      sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: 'SBA SUBNet',
      sourceType: 'official',
      capturedAt: now,
      confidence: 1,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: 1,
    riskFlags: ['prime_subcontracting_opportunity', 'human_verification_required'],
    brokerability: 'medium',
    metadata: {
      providerId: 'provider:sba-subnet',
      opportunityKind: 'subcontracting',
      automationLevel: 'ai_plus_user',
      requiresUserApproval: true,
      primeName: input.primeName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      outreachAuthorized: false,
      bidSubmissionAuthorized: false,
      paymentAuthorized: false,
    },
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
}
