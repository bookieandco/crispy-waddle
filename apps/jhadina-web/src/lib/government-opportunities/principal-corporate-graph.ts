export type PrincipalGraphNodeType = 'PRINCIPAL' | 'CORPORATE_ENTITY'

export type PrincipalCorporateRelationshipType =
  | 'OFFICER_OF'
  | 'OWNER_OF'
  | 'CONTROLS'
  | 'UBO_OF'
  | 'DIRECTOR_OF'
  | 'AGENT_OF'
  | 'SECRETARY_OF'
  | 'RELATED_TO'

export interface PrincipalGraphNode {
  id: string
  type: PrincipalGraphNodeType
  canonicalId: string
  displayName: string
  jurisdiction?: string
  identifiers?: Array<{ system: string; value: string }>
}

export interface PrincipalGraphEvidence {
  evidenceId: string
  providerId: string
  sourceRecordId?: string
  sourceUrl?: string
  observedAt?: string
  retrievedAt?: string
  confidence?: number
}

export interface PrincipalCorporateEdge {
  id: string
  subjectId: string
  objectId: string
  relationshipType: PrincipalCorporateRelationshipType
  status: 'CURRENT' | 'FORMER' | 'UNKNOWN'
  confidence: number
  evidenceIds: string[]
  provenance: PrincipalGraphEvidence[]
}

export interface PrincipalCorporateGraph {
  nodes: PrincipalGraphNode[]
  edges: PrincipalCorporateEdge[]
}

export interface PrincipalGraphInput {
  principal: PrincipalGraphNode
  corporateEntity: PrincipalGraphNode
  relationshipType: PrincipalCorporateRelationshipType
  status?: 'CURRENT' | 'FORMER' | 'UNKNOWN'
  confidence: number
  evidence: PrincipalGraphEvidence[]
}

/**
 * Builds a provenance-preserving principal ↔ corporate graph.
 *
 * This layer records relationships; it does not infer ownership or control.
 * Ownership/control edges must arrive with explicit evidence from a qualifying
 * source. Officer relationships remain distinct from ownership/control.
 */
export function buildPrincipalCorporateGraph(
  inputs: PrincipalGraphInput[],
): PrincipalCorporateGraph {
  const nodes = new Map<string, PrincipalGraphNode>()
  const edges = new Map<string, PrincipalCorporateEdge>()

  for (const input of inputs) {
    nodes.set(input.principal.id, input.principal)
    nodes.set(input.corporateEntity.id, input.corporateEntity)

    const evidenceIds = [...new Set(input.evidence.map((e) => e.evidenceId))]
    const edgeId = [input.principal.id, input.relationshipType, input.corporateEntity.id].join(':')
    const existing = edges.get(edgeId)

    if (existing) {
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...evidenceIds])]
      existing.provenance = [...existing.provenance, ...input.evidence]
        .filter((e, index, all) => all.findIndex((x) => x.evidenceId === e.evidenceId) === index)
      existing.confidence = Math.max(existing.confidence, input.confidence)
      continue
    }

    edges.set(edgeId, {
      id: edgeId,
      subjectId: input.principal.id,
      objectId: input.corporateEntity.id,
      relationshipType: input.relationshipType,
      status: input.status ?? 'UNKNOWN',
      confidence: input.confidence,
      evidenceIds,
      provenance: input.evidence,
    })
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  }
}

export function getPrincipalRelationships(
  graph: PrincipalCorporateGraph,
  principalId: string,
): PrincipalCorporateEdge[] {
  return graph.edges.filter((edge) => edge.subjectId === principalId)
}

export function getCorporatePrincipals(
  graph: PrincipalCorporateGraph,
  corporateEntityId: string,
): PrincipalCorporateEdge[] {
  return graph.edges.filter((edge) => edge.objectId === corporateEntityId)
}
