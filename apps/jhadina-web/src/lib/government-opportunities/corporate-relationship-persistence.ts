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

/** Application boundary for persisting relationship edges. */
export async function persistCorporateRelationships(
  writer: CorporateRelationshipWriter,
  relationships: Array<CorporateRelationship & { observedAt?: string; metadata?: Record<string, unknown> }>,
) {
  const persisted: Array<{ id: string }> = []
  const seen = new Set<string>()

  for (const relationship of relationships) {
    const normalized = normalizeCorporateRelationship({
      fromEntityId: relationship.fromEntityId,
      toEntityId: relationship.toEntityId,
      relationshipType: relationship.type,
      confidence: relationship.confidence,
      source: relationship.source,
      sourceReference: relationship.sourceReference,
      evidenceIds: relationship.evidenceIds,
      observedAt: relationship.observedAt,
      metadata: relationship.metadata,
    })

    const key = [
      normalized.fromEntityId,
      normalized.toEntityId,
      normalized.relationshipType,
      normalized.source,
      normalized.sourceReference,
    ].join('|')

    if (seen.has(key)) continue
    seen.add(key)
    persisted.push(await writer.upsertRelationship(normalized))
  }

  return persisted
}
