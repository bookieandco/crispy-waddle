import type { Opportunity } from '../domain/opportunity.js'
import { isCompleteVerification, type VerificationDecision } from '../domain/verification.js'

export type OverageVerificationChecks = {
  source_record: 'pending' | 'verified' | 'rejected'
  property_reference: 'pending' | 'verified' | 'rejected'
  claimant_identity: 'pending' | 'verified' | 'rejected'
  entitlement: 'pending' | 'verified' | 'rejected'
}

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
  verificationChecks?: Partial<OverageVerificationChecks>
  verificationDecision?: VerificationDecision
  description?: string
  capturedAt?: string
  sourceConfidence?: number
  riskFlags?: string[]
}

const defaultChecks = (): OverageVerificationChecks => ({
  source_record: 'pending',
  property_reference: 'pending',
  claimant_identity: 'pending',
  entitlement: 'pending',
})

export function adaptOverageOpportunity(input: OverageOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const checks: OverageVerificationChecks = {
    ...defaultChecks(),
    ...input.verificationChecks,
  }
  const decision = input.verificationDecision
  const opportunityId = `overage:${input.id}`
  const verified = isCompleteVerification(decision, opportunityId)
  const sourceConfidence = Math.max(0, Math.min(1, input.sourceConfidence ?? (checks.source_record === 'verified' ? 1 : 0)))
  const riskFlags = [
    ...Object.entries(checks)
      .filter(([, value]) => value !== 'verified')
      .map(([key, value]) => `unverified:${key}:${value}`),
    ...(input.riskFlags ?? []),
  ]

  return {
    id: opportunityId,
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
      confidence: value === 'verified' ? 1 : 0,
      verified: value === 'verified',
    })),
    evidence: [{
      id: `${input.id}:source`,
      sourceId: input.id,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName ?? 'Recovery source',
      sourceType: 'official',
      capturedAt: now,
      confidence: sourceConfidence,
    }],
    verificationStatus: verified ? 'verified' : Object.values(checks).some(value => value === 'verified') ? 'partially_verified' : 'unverified',
    verificationDecision: decision,
    sourceConfidence,
    riskFlags,
    brokerability: 'restricted',
    metadata: { providerId: 'provider:overageos', opportunityKind: 'overage', automationLevel: 'user_led', requiresUserApproval: true },
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
}
