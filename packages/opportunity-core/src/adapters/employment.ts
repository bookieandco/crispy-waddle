import type { Opportunity, OpportunityClaim } from '../domain/opportunity.js'

export type EmploymentOpportunityInput = {
  providerId: string
  externalId: string
  title: string
  sourceUrl: string
  sourceName: string
  description?: string
  kind?: 'ai_job' | 'remote_gig' | 'freelance'
  pay?: { min?: number; max?: number; currency?: string; cadence?: string }
  deadline?: string
  requirements?: string[]
  remote?: boolean
  capturedAt?: string
  confidence?: number
  sourceType?: OpportunityClaim['sourceType']
  riskFlags?: string[]
}

export function adaptEmploymentOpportunity(input: EmploymentOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const confidence = clamp01(input.confidence ?? 0.5)
  const sourceType = input.sourceType ?? 'secondary'
  const kind = input.kind ?? 'ai_job'
  const sourceId = `${input.providerId}:${input.externalId}`

  return {
    id: `employment:${sourceId}`,
    title: input.title,
    family: 'employment',
    type: kind === 'ai_job' ? 'job' : 'gig',
    description: input.description,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    sourceId,
    amount: input.pay ? { min: input.pay.min, max: input.pay.max, currency: input.pay.currency ?? 'USD' } : undefined,
    deadline: input.deadline,
    requirements: input.requirements,
    eligibility: { remote: input.remote ?? false },
    claims: [{
      id: `${sourceId}:listing`,
      field: 'listing',
      value: input.title,
      sourceId,
      sourceType,
      confidence,
      verified: sourceType === 'official' && confidence === 1,
    }],
    evidence: [{
      id: `${sourceId}:source`,
      sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      sourceType,
      capturedAt: now,
      confidence,
    }],
    verificationStatus: 'unverified',
    sourceConfidence: confidence,
    riskFlags: input.riskFlags ?? [],
    brokerability: 'unknown',
    metadata: {
      providerId: input.providerId,
      opportunityKind: kind,
      automationLevel: kind === 'ai_job' ? 'ai_plus_user' : 'user_led',
      payCadence: input.pay?.cadence ?? 'unknown',
      requiresUserApproval: true,
    },
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
