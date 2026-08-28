import type { CorporateRelationship } from './corporate-intelligence'
import { normalizeCorporateRelationship } from './corporate-relationship-graph'

export type CorporateRelationshipWriter = {
  upsertRelationship(input: {
    fromEntityId: string
    toEntityId: string
    relationshipType: CorporateRelationship['type'] | 'AFFILIATE' | 'SUCCESSOR' | 'PREDECESSOR'
    confidence: number
    source: string
    sourceReference: string
    evidenceIds: string[]
    observedAt?: string
    metadata?: Record<string, unknown>
  }): Promise<{ id: string }>
}

/**
 * Application boundary for persisting relationship edges.
 * Keeps provider-specific relationship shapes out of the database adapter.
 */
export async function persistCorporateRelationships(
  writer: CorporateRelationshipWriter,
  relationships: Array<CorporateRelationship & { observedAt?: string; metadata?: Record<string, unknown> }>,
) {
  const normalized = relationships.map((relationship) => normalizeCorporateRelationship({
    fromEntityId: relationship.fromEntityId,
    toEntityId: relationship.toEntityId,
    relationshipType: relationship.type,
    confidence: relationship.confidence,
    source: relationship.source,
    sourceReference: relationship.sourceReference,
    evidenceIds: relationship.evidenceIds,
    observedAt: relationship.observedAt,
    metadata: relationship.metadata,
  }))

  const persisted: Array<{ id: string }> = []
  for (const relationship of normalized) {
    persisted.push(await writer.upsertRelationship(relationship))
  }
  return persisted
}
