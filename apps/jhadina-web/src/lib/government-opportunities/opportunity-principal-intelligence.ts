export type OpportunityPrincipalRelevance =
  | 'DIRECT'
  | 'CORPORATE'
  | 'HISTORICAL'
  | 'INDIRECT'
  | 'NONE'

export interface OpportunityPrincipalEvidence {
  evidenceId: string
  providerId: string
  sourceRecordId?: string
  sourceUrl?: string
  observedAt?: string
  retrievedAt?: string
  confidence?: number
}

export interface OpportunityPrincipalInput {
  opportunityId: string
  principalId: string
  corporateEntityId: string
  opportunityStatus?: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  principalDisposition:
    | 'QUALIFIED'
    | 'PROVISIONAL'
    | 'INSUFFICIENT_EVIDENCE'
    | 'CONFLICTED'
    | 'STALE'
    | 'REVIEW_REQUIRED'
  relationshipType:
    | 'OFFICER_OF'
    | 'DIRECTOR_OF'
    | 'OWNER_OF'
    | 'CONTROLS'
    | 'UBO_OF'
    | 'AGENT_OF'
    | 'SECRETARY_OF'
    | 'RELATED_TO'
  relationshipStatus: 'CURRENT' | 'FORMER' | 'UNKNOWN'
  relationshipConfidence: number
  evidence: OpportunityPrincipalEvidence[]
}

export interface OpportunityPrincipalAssessment {
  opportunityId: string
  principalId: string
  corporateEntityId: string
  relevance: OpportunityPrincipalRelevance
  relevanceScore: number
  opportunityStatus: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  relationshipType: OpportunityPrincipalInput['relationshipType']
  relationshipStatus: OpportunityPrincipalInput['relationshipStatus']
  supportingEvidenceIds: string[]
  reasons: string[]
  evaluatedAt: string
  engineVersion: string
}

const ENGINE_VERSION = 'oce-6.72.0'

/**
 * Connects an opportunity to an already-resolved principal/corporate relationship.
 * This layer ranks relevance; it does not infer identity, ownership, or eligibility.
 */
export function assessOpportunityPrincipal(
  input: OpportunityPrincipalInput,
  evaluatedAt = new Date().toISOString(),
): OpportunityPrincipalAssessment {
  const evidence = dedupeEvidence(input.evidence)
  const evidenceScore = averageConfidence(evidence)
  const relationshipScore = clamp(input.relationshipConfidence)
  let score = 0
  const reasons: string[] = []

  if (input.opportunityStatus === 'ACTIVE') {
    score += 10
    reasons.push('opportunity is active')
  }

  if (input.relationshipStatus === 'CURRENT') {
    score += 15
    reasons.push('principal relationship is current')
  } else if (input.relationshipStatus === 'FORMER') {
    score += 5
    reasons.push('principal relationship is historical')
  }

  switch (input.relationshipType) {
    case 'OWNER_OF':
    case 'CONTROLS':
    case 'UBO_OF':
      score += 35
      reasons.push(`relationship is ${input.relationshipType}`)
      break
    case 'DIRECTOR_OF':
    case 'OFFICER_OF':
      score += 25
      reasons.push(`relationship is ${input.relationshipType}`)
      break
    case 'AGENT_OF':
    case 'SECRETARY_OF':
      score += 15
      reasons.push(`relationship is ${input.relationshipType}`)
      break
    case 'RELATED_TO':
      score += 5
      reasons.push('relationship is indirect')
      break
  }

  score += Math.round(relationshipScore * 0.2)
  score += Math.round(evidenceScore * 0.2)

  if (input.principalDisposition === 'CONFLICTED' || input.principalDisposition === 'STALE') {
    score -= 25
    reasons.push(`principal disposition is ${input.principalDisposition}`)
  } else if (input.principalDisposition === 'QUALIFIED') {
    score += 10
    reasons.push('principal is qualified')
  } else if (input.principalDisposition === 'PROVISIONAL') {
    reasons.push('principal is provisional')
  }

  score = clamp(score)

  let relevance: OpportunityPrincipalRelevance = 'NONE'
  if (score >= 75) relevance = 'DIRECT'
  else if (score >= 55) relevance = 'CORPORATE'
  else if (score >= 35) relevance = input.relationshipStatus === 'FORMER' ? 'HISTORICAL' : 'INDIRECT'

  if (input.principalDisposition === 'INSUFFICIENT_EVIDENCE' || input.principalDisposition === 'REVIEW_REQUIRED') {
    relevance = 'NONE'
    reasons.push('principal evidence is insufficient for opportunity linkage')
  }

  return {
    opportunityId: input.opportunityId,
    principalId: input.principalId,
    corporateEntityId: input.corporateEntityId,
    relevance,
    relevanceScore: score,
    opportunityStatus: input.opportunityStatus ?? 'UNKNOWN',
    relationshipType: input.relationshipType,
    relationshipStatus: input.relationshipStatus,
    supportingEvidenceIds: evidence.map((item) => item.evidenceId),
    reasons,
    evaluatedAt,
    engineVersion: ENGINE_VERSION,
  }
}

function dedupeEvidence(evidence: OpportunityPrincipalEvidence[]): OpportunityPrincipalEvidence[] {
  const byId = new Map<string, OpportunityPrincipalEvidence>()
  for (const item of evidence) byId.set(item.evidenceId, item)
  return [...byId.values()]
}

function averageConfidence(evidence: OpportunityPrincipalEvidence[]): number {
  if (evidence.length === 0) return 0
  return evidence.reduce((sum, item) => sum + clamp(item.confidence ?? 0), 0) / evidence.length
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
