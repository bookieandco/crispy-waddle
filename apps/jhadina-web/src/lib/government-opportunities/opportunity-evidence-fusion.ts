export type OpportunityEvidenceKind =
  | 'corporate_record'
  | 'procurement_record'
  | 'license'
  | 'registration'
  | 'contract'
  | 'capability'

export interface OpportunityEvidence {
  id: string
  kind: OpportunityEvidenceKind
  source: string
  sourceReference: string
  companyEntityId?: string
  opportunityId?: string
  jurisdiction?: string
  confidence: number
  observedAt?: string
  metadata?: Record<string, unknown>
}

export interface FusedOpportunityIntelligence {
  opportunityId: string
  companyEntityIds: string[]
  evidenceIds: string[]
  evidenceByKind: Partial<Record<OpportunityEvidenceKind, string[]>>
  confidence: number
  jurisdictions: string[]
  limitations: string[]
}

function normalizeEvidence(evidence: OpportunityEvidence): OpportunityEvidence {
  return {
    ...evidence,
    confidence: Math.max(0, Math.min(1, evidence.confidence)),
  }
}

/**
 * Fuses independent evidence into one auditable opportunity intelligence record.
 * Fusion is aggregation only; it does not determine bid eligibility or award probability.
 */
export function fuseOpportunityEvidence(
  opportunityId: string,
  evidence: OpportunityEvidence[],
): FusedOpportunityIntelligence {
  const relevant = evidence
    .filter((item) => item.opportunityId === opportunityId)
    .map(normalizeEvidence)

  const evidenceByKind: Partial<Record<OpportunityEvidenceKind, string[]>> = {}
  for (const item of relevant) {
    const ids = evidenceByKind[item.kind] ?? []
    ids.push(item.id)
    evidenceByKind[item.kind] = [...new Set(ids)].sort()
  }

  const companyEntityIds = [...new Set(
    relevant.flatMap((item) => item.companyEntityId ? [item.companyEntityId] : []),
  )].sort()

  const jurisdictions = [...new Set(
    relevant.flatMap((item) => item.jurisdiction ? [item.jurisdiction] : []),
  )].sort()

  const limitations: string[] = []
  if (!evidenceByKind.procurement_record?.length) {
    limitations.push('No procurement evidence attached.')
  }
  if (!evidenceByKind.corporate_record?.length) {
    limitations.push('No corporate-record evidence attached.')
  }
  if (!evidenceByKind.capability?.length) {
    limitations.push('No capability evidence attached.')
  }

  const confidence = relevant.length === 0
    ? 0
    : relevant.reduce((sum, item) => sum + item.confidence, 0) / relevant.length

  return {
    opportunityId,
    companyEntityIds,
    evidenceIds: [...new Set(relevant.map((item) => item.id))].sort(),
    evidenceByKind,
    confidence,
    jurisdictions,
    limitations,
  }
}
