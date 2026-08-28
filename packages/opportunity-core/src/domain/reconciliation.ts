import type { Opportunity, OpportunityType } from './opportunity.js'

export type SourcePrecedence = 'official' | 'secondary' | 'community' | 'user' | 'model'

export type OpportunitySourceMapping = {
  sourceId: string
  sourcePrecedence: SourcePrecedence
  externalId?: string
  sourceType: string
  mapsTo: OpportunityType | 'other'
  requiresVerification: boolean
}

export type ReconciliationDecision =
  | 'accept'
  | 'merge'
  | 'supersede'
  | 'quarantine'
  | 'reject'
  | 'needs_human_review'

export type ReconciliationResult = {
  canonicalOpportunityId: string
  decision: ReconciliationDecision
  authoritativeSourceId?: string
  conflictingClaimIds: string[]
  unresolvedFields: string[]
}

export const SOURCE_PRECEDENCE: readonly SourcePrecedence[] = [
  'official',
  'secondary',
  'community',
  'user',
  'model',
] as const

export function chooseClaimSource(claims: Opportunity['claims']): string | undefined {
  const rank: Record<OpportunitySourceMapping['sourcePrecedence'], number> = {
    official: 5,
    secondary: 4,
    community: 3,
    user: 2,
    model: 1,
  }

  const sourceTypeToPrecedence: Record<Opportunity['claims'][number]['sourceType'], SourcePrecedence> = {
    official: 'official',
    secondary: 'secondary',
    transcript: 'secondary',
    user: 'user',
    model: 'model',
  }

  return [...claims]
    .sort((a, b) => rank[sourceTypeToPrecedence[b.sourceType]] - rank[sourceTypeToPrecedence[a.sourceType]])[0]?.sourceId
}

export function reconciliationDecision(opportunity: Opportunity): ReconciliationDecision {
  if (opportunity.verificationStatus === 'rejected') return 'reject'
  if (opportunity.evidence.length === 0) return 'quarantine'
  if (opportunity.claims.some((claim) => !claim.verified)) return 'needs_human_review'
  if (opportunity.verificationStatus === 'verified') return 'accept'
  return 'needs_human_review'
}
