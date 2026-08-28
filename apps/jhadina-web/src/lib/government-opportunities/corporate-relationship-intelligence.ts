export type CorporateRelationshipType = 'OFFICER_OF' | 'OWNER_OF' | 'REGISTERED_AGENT_OF' | 'SUBSIDIARY_OF' | 'PARENT_OF' | 'LOCATED_AT' | 'PROCUREMENT_RECIPIENT_OF'

export interface CorporateRelationship {
  id: string
  fromEntityId: string
  toEntityId: string
  type: CorporateRelationshipType
  sourceId: string
  evidenceId?: string
  observedAt: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface CorporateRelationshipGraph { relationships: CorporateRelationship[] }

export function createCorporateRelationship(input: Omit<CorporateRelationship, 'id'> & { id?: string }): CorporateRelationship {
  if (!input.fromEntityId || !input.toEntityId || !input.sourceId) throw new Error('entity IDs and sourceId are required')
  if (input.fromEntityId === input.toEntityId) throw new Error('self-referential corporate relationships are not permitted')
  return { ...input, id: input.id ?? `${input.fromEntityId}:${input.type}:${input.toEntityId}` }
}

export function upsertCorporateRelationship(graph: CorporateRelationshipGraph, relationship: CorporateRelationship): CorporateRelationshipGraph {
  const index = graph.relationships.findIndex((item) => item.id === relationship.id)
  if (index === -1) return { relationships: [...graph.relationships, relationship] }
  const relationships = [...graph.relationships]
  relationships[index] = relationship
  return { relationships }
}

export function getCorporateNeighbors(graph: CorporateRelationshipGraph, entityId: string): CorporateRelationship[] {
  return graph.relationships.filter((relationship) => relationship.fromEntityId === entityId || relationship.toEntityId === entityId)
}
