export type ProviderGraphNodeType = 'COMPANY' | 'OWNER' | 'AGENCY' | 'OPPORTUNITY' | 'CONTRACT' | 'SERVICE' | 'JURISDICTION'

export type ProviderGraphEdgeType =
  | 'OWNS'
  | 'AWARDED_TO'
  | 'INCUMBENT_FOR'
  | 'LOCATED_IN'
  | 'PERFORMS'
  | 'PROCURED_BY'
  | 'RECOMPETES_FOR'
  | 'SUBCONTRACTS'
  | 'COMPETES_WITH'

export type ProviderGraphNode = {
  id: string
  type: ProviderGraphNodeType
  name: string
  jurisdiction?: string
  identifiers?: string[]
  evidenceIds: string[]
}

export type ProviderGraphEdge = {
  id: string
  fromId: string
  toId: string
  type: ProviderGraphEdgeType
  confidence: number
  evidenceIds: string[]
  observedAt?: string
}

export type ProviderGraph = {
  nodes: ProviderGraphNode[]
  edges: ProviderGraphEdge[]
}

export type ProviderIntelligence = {
  companyId: string
  ownerIds: string[]
  contractIds: string[]
  opportunityIds: string[]
  agencyIds: string[]
  serviceIds: string[]
  jurisdictionIds: string[]
  incumbentCount: number
  evidenceIds: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Builds a traceable company-centric view from graph relationships.
 * Ownership/control relationships remain evidence-backed; this layer does not
 * perform identity resolution or infer ownership from a name alone.
 */
export function getProviderIntelligence(graph: ProviderGraph, companyId: string): ProviderIntelligence {
  const company = graph.nodes.find((node) => node.id === companyId && node.type === 'COMPANY')
  if (!company) {
    return { companyId, ownerIds: [], contractIds: [], opportunityIds: [], agencyIds: [], serviceIds: [], jurisdictionIds: [], incumbentCount: 0, evidenceIds: [] }
  }

  const outgoing = graph.edges.filter((edge) => edge.fromId === companyId)
  const incoming = graph.edges.filter((edge) => edge.toId === companyId)
  const related = [...outgoing, ...incoming]
  const idsByType = (types: ProviderGraphEdgeType[], nodeType: ProviderGraphNodeType) =>
    related
      .filter((edge) => types.includes(edge.type))
      .map((edge) => edge.fromId === companyId ? edge.toId : edge.fromId)
      .filter((id) => graph.nodes.some((node) => node.id === id && node.type === nodeType))

  const ownerIds = idsByType(['OWNS'], 'OWNER')
  const contractIds = idsByType(['AWARDED_TO', 'RECOMPETES_FOR'], 'CONTRACT')
  const opportunityIds = idsByType(['INCUMBENT_FOR', 'RECOMPETES_FOR'], 'OPPORTUNITY')
  const agencyIds = idsByType(['PROCURED_BY'], 'AGENCY')
  const serviceIds = idsByType(['PERFORMS'], 'SERVICE')
  const jurisdictionIds = idsByType(['LOCATED_IN'], 'JURISDICTION')
  const incumbentCount = graph.edges.filter((edge) => edge.type === 'INCUMBENT_FOR' && edge.fromId === companyId).length

  return {
    companyId,
    ownerIds: [...new Set(ownerIds)],
    contractIds: [...new Set(contractIds)],
    opportunityIds: [...new Set(opportunityIds)],
    agencyIds: [...new Set(agencyIds)],
    serviceIds: [...new Set(serviceIds)],
    jurisdictionIds: [...new Set(jurisdictionIds)],
    incumbentCount,
    evidenceIds: [...new Set([...
      company.evidenceIds,
      ...related.flatMap((edge) => edge.evidenceIds),
    ])],
  }
}

export function normalizeGraphConfidence(edges: ProviderGraphEdge[]): ProviderGraphEdge[] {
  return edges.map((edge) => ({ ...edge, confidence: clamp(edge.confidence) }))
}
