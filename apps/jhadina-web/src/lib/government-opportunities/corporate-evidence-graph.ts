export type CorporateFactType = 'IDENTITY' | 'REGISTRATION' | 'STATUS' | 'ADDRESS' | 'OFFICER' | 'OWNERSHIP' | 'RELATIONSHIP'

export interface CorporateEvidenceRef {
  evidenceId: string
  sourceId: string
  sourceUrl?: string
  provider: string
  retrievedAt: string
  recordId?: string
}

export interface CorporateFact {
  entityId: string
  type: CorporateFactType
  value: unknown
  observedAt: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  evidence: CorporateEvidenceRef[]
}

export interface CorporateEvidenceGraph {
  entityId: string
  facts: CorporateFact[]
}

export function createCorporateFact(
  entityId: string,
  type: CorporateFactType,
  value: unknown,
  evidence: CorporateEvidenceRef[],
  confidence: CorporateFact['confidence'] = 'MEDIUM',
  observedAt = new Date().toISOString(),
): CorporateFact {
  if (!entityId.trim()) throw new Error('entityId is required')
  if (!evidence.length) throw new Error('at least one evidence reference is required')
  return { entityId: entityId.trim(), type, value, evidence, confidence, observedAt }
}

/** Adds a fact only when it has explicit source provenance. */
export function appendCorporateFact(graph: CorporateEvidenceGraph, fact: CorporateFact): CorporateEvidenceGraph {
  if (fact.entityId !== graph.entityId) throw new Error('fact entityId does not match graph entityId')
  return { ...graph, facts: [...graph.facts, fact] }
}

export function getFactsByType(graph: CorporateEvidenceGraph, type: CorporateFactType): CorporateFact[] {
  return graph.facts.filter((fact) => fact.type === type)
}
