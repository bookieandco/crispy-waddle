import type { Opportunity } from '../domain/opportunity.js'

export type OverageOpportunityInput = {
  id: string
  title: string
  amount?: number
  currency?: string
  deadline?: string
  sourceUrl: string
  sourceName?: string
  jurisdiction?: { country?: string; region?: string; locality?: string }
  propertyReference?: string
  claimantVerified: boolean
  saleVerified: boolean
  entitlementVerified: boolean
  sourceRecordVerified: boolean
  description?: string
  capturedAt?: string
}

export function adaptOverageOpportunity(input: OverageOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const checks = {
    claimantVerified: input.claimantVerified,
    saleVerified: input.saleVerified,
    entitlementVerified: input.entitlementVerified,
    sourceRecordVerified: input.sourceRecordVerified,
  }
  const verified = Object.values(checks).every(Boolean)
  const riskFlags = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => `unverified:${key}`)

  return {
    id: `overage:${input.id}`,
    title: input.title,
    family: 'recovery',
    type: 'recovery',
    description: input.description,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName ?? 'Recovery source',
    amount: input.amount === undefined ? undefined : { max: input.amount, currency: input.currency ?? 'USD' },
    deadline: input.deadline,
    jurisdiction: input.jurisdiction,
    eligibility: {
      propertyReference: input.propertyReference,
      verificationChecks: checks,
    },
    claims: Object.entries(checks).map(([field, value]) => ({
      id: `${input.id}:${field}`,
      field,
      value,
      sourceId: input.id,
      sourceType: 'official' as const,
      confidence: value ? 1 : 0,
      verified: value,
    })),
    evidence: [{
      id: `${input.id}:source`,
      sourceId: input.id,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName ?? 'Recovery source',
      sourceType: 'official',
      capturedAt: now,
      confidence: input.sourceRecordVerified ? 1 : 0,
    }],
    verificationStatus: verified ? 'verified' : 'partially_verified',
    sourceConfidence: input.sourceRecordVerified ? 1 : 0,
    riskFlags,
    brokerability: 'restricted',
    status: verified ? 'verified' : 'research_pending',
    createdAt: now,
    updatedAt: now,
  }
}
