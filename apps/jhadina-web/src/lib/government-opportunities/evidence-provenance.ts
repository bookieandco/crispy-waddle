export type EvidenceKind =
  | 'SOURCE_PAGE'
  | 'DOCUMENT'
  | 'AWARD_RECORD'
  | 'ENTITY_RECORD'
  | 'LICENSE_RECORD'
  | 'REGULATION'
  | 'BUDGET_RECORD'
  | 'PUBLIC_NOTICE'

export type EvidenceRecord = {
  id: string
  kind: EvidenceKind
  url?: string
  title?: string
  publisher?: string
  observedAt: string
  contentHash?: string
  sourceId?: string
  entityId?: string
}

export type EvidenceLink = {
  opportunityId: string
  evidenceId: string
  relationship:
    | 'DISCOVERED_FROM'
    | 'VERIFIES_ENTITY'
    | 'VERIFIES_DEMAND'
    | 'VERIFIES_VALUE'
    | 'VERIFIES_DEADLINE'
    | 'VERIFIES_LIFECYCLE'
    | 'VERIFIES_PROVIDER'
    | 'SUPPORTS_SCORE'
  confidence: number
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Create an auditable provenance edge between an opportunity and evidence. */
export function linkOpportunityEvidence(
  opportunityId: string,
  evidence: EvidenceRecord,
  relationship: EvidenceLink['relationship'],
  confidence: number,
): EvidenceLink {
  return {
    opportunityId,
    evidenceId: evidence.id,
    relationship,
    confidence: Math.round(clamp(confidence)),
  }
}

/**
 * Return evidence links that can be used to audit a particular opportunity.
 * The caller owns persistence and may require stronger confidence thresholds.
 */
export function auditEvidenceLinks(
  opportunityId: string,
  links: EvidenceLink[],
): EvidenceLink[] {
  return links.filter((link) => link.opportunityId === opportunityId)
}
