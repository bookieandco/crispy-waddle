import type { CorporateRelationship } from './corporate-intelligence'

export type OwnerControlRole = 'OWNER' | 'OFFICER' | 'CONTROL_PERSON'

export interface OwnerControlRelationship {
  companyEntityId: string
  personEntityId: string
  role: OwnerControlRole
  confidence: number
  source: string
  sourceReference: string
  evidenceIds: string[]
  observedAt?: string
  metadata?: Record<string, unknown>
}

/**
 * Converts registry-derived person/company relationships into an evidence-backed
 * owner/control record. A name match alone is never treated as ownership proof.
 */
export function normalizeOwnerControlRelationship(
  relationship: OwnerControlRelationship,
): OwnerControlRelationship {
  return {
    ...relationship,
    confidence: Math.max(0, Math.min(1, relationship.confidence)),
    evidenceIds: [...new Set(relationship.evidenceIds)].sort(),
  }
}

export function ownerControlToCorporateRelationship(
  relationship: OwnerControlRelationship,
): CorporateRelationship {
  const normalized = normalizeOwnerControlRelationship(relationship)

  return {
    fromEntityId: normalized.companyEntityId,
    toEntityId: normalized.personEntityId,
    type: normalized.role,
    confidence: normalized.confidence,
    source: normalized.source,
    sourceReference: normalized.sourceReference,
    evidenceIds: normalized.evidenceIds,
  }
}

export function dedupeOwnerControlRelationships(
  relationships: OwnerControlRelationship[],
): OwnerControlRelationship[] {
  const byKey = new Map<string, OwnerControlRelationship>()

  for (const relationship of relationships.map(normalizeOwnerControlRelationship)) {
    const key = [
      relationship.companyEntityId,
      relationship.personEntityId,
      relationship.role,
      relationship.source,
      relationship.sourceReference,
    ].join('|')

    const existing = byKey.get(key)
    if (!existing || relationship.confidence > existing.confidence) {
      byKey.set(key, relationship)
    }
  }

  return [...byKey.values()]
}
