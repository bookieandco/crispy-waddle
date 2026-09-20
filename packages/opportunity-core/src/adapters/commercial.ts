import type { Opportunity, OpportunityClaim } from '../domain/opportunity.js'

export type CommercialOpportunityKind = 'affiliate' | 'pod' | 'dropshipping' | 'creator' | 'digital_product' | 'service'

export type CommercialOpportunityInput = {
  providerId: string
  externalId: string
  kind: CommercialOpportunityKind
  title: string
  sourceUrl: string
  sourceName: string
  description?: string
  estimatedRevenue?: { min?: number; max?: number; currency?: string; cadence?: string }
  startupCost?: number
  estimatedHours?: number
  deadline?: string
  capturedAt?: string
  confidence?: number
  sourceType?: OpportunityClaim['sourceType']
  riskFlags?: string[]
}

export function adaptCommercialOpportunity(input: CommercialOpportunityInput): Opportunity {
  const now = input.capturedAt ?? new Date().toISOString()
  const confidence = clamp01(input.confidence ?? 0.5)
  const sourceType = input.sourceType ?? 'secondary'
  const sourceId = `${input.providerId}:${input.externalId}`
  const family: Opportunity['family'] =
    input.kind === 'pod' ? 'commerce' :
    input.kind === 'creator' ? 'creator' :
    'business'
  const uiKind =
    input.kind === 'digital_product' || input.kind === 'service'
      ? 'automation'
      : input.kind

  return {
    id: `commercial:${sourceId}`,
    title: input.title,
    family,
    type: 'commercial',
    description: input.description,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    sourceId,
    amount: input.estimatedRevenue ? {
      min: input.estimatedRevenue.min,
      max: input.estimatedRevenue.max,
      currency: input.estimatedRevenue.currency ?? 'USD',
    } : undefined,
    deadline: input.deadline,
    claims: [{
      id: `${sourceId}:candidate`,
      field: 'candidate',
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
      commercialKind: input.kind,
      opportunityKind: uiKind,
      automationLevel: input.kind === 'creator' ? 'ai_plus_user' : 'ai_can_do_it',
      startupCost: input.startupCost ?? null,
      estimatedHours: input.estimatedHours ?? null,
      payCadence: input.estimatedRevenue?.cadence ?? 'unknown',
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
