import type {
  CorporateEntity,
  CorporateRelationship,
} from './corporate-intelligence'

export type CorporateEvidenceRecord = {
  id: string
  source: CorporateEntity['source']
  sourceReference: string
  retrievedAt: string
  contentHash?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type PersistedCorporateEntity = CorporateEntity & {
  canonicalKey: string
  firstSeenAt: string
  lastSeenAt: string
  evidenceIds: string[]
}

export type PersistedCorporateRelationship = CorporateRelationship & {
  firstSeenAt: string
  lastSeenAt: string
}

export type CorporateIntelligencePersistence = {
  upsertEntity(entity: PersistedCorporateEntity): Promise<void>
  upsertRelationship(relationship: PersistedCorporateRelationship): Promise<void>
  upsertEvidence(evidence: CorporateEvidenceRecord): Promise<void>
  getEntityByCanonicalKey(canonicalKey: string): Promise<PersistedCorporateEntity | null>
  getRelationships(entityId: string): Promise<PersistedCorporateRelationship[]>
}

export function canonicalCorporateKey(input: {
  legalName: string
  jurisdiction?: string
  entityNumber?: string
}): string {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const jurisdiction = normalize(input.jurisdiction ?? '')
  const entityNumber = normalize(input.entityNumber ?? '')
  const name = normalize(input.legalName)

  // Prefer the registry identifier when present; otherwise use the strongest
  // available public-record identity tuple. Never use an owner/person name.
  return entityNumber
    ? `${jurisdiction}:${entityNumber}`
    : `${jurisdiction}:${name}`
}

export function reconcileCorporateEntity(input: {
  incoming: CorporateEntity
  existing: PersistedCorporateEntity | null
  observedAt: string
}): PersistedCorporateEntity {
  const { incoming, existing, observedAt } = input
  const canonicalKey = canonicalCorporateKey(incoming)
  const evidenceIds = [...new Set([...(existing?.evidenceIds ?? []), ...incoming.evidenceIds])]

  return {
    ...existing,
    ...incoming,
    id: existing?.id ?? incoming.id,
    canonicalKey,
    firstSeenAt: existing?.firstSeenAt ?? observedAt,
    lastSeenAt: observedAt,
    evidenceIds,
  }
}

export function reconcileCorporateRelationship(input: {
  incoming: CorporateRelationship
  existing: PersistedCorporateRelationship | null
  observedAt: string
}): PersistedCorporateRelationship {
  return {
    ...input.existing,
    ...input.incoming,
    firstSeenAt: input.existing?.firstSeenAt ?? input.observedAt,
    lastSeenAt: input.observedAt,
    evidenceIds: [...new Set([...(input.existing?.evidenceIds ?? []), ...input.incoming.evidenceIds])],
  }
}

/**
 * Persistence boundary for OCE corporate intelligence.
 * The application can back this with Supabase, another database, or an
 * in-memory implementation without changing the OpenCorporates connector.
 */
export async function persistCorporateSnapshot(
  persistence: CorporateIntelligencePersistence,
  input: {
    entity: CorporateEntity
    relationships?: CorporateRelationship[]
    evidence: CorporateEvidenceRecord[]
    observedAt: string
  },
): Promise<PersistedCorporateEntity> {
  const existing = await persistence.getEntityByCanonicalKey(canonicalCorporateKey(input.entity))
  const entity = reconcileCorporateEntity({ incoming: input.entity, existing, observedAt: input.observedAt })

  await persistence.upsertEntity(entity)
  for (const evidence of input.evidence) await persistence.upsertEvidence(evidence)
  for (const relationship of input.relationships ?? []) {
    const existingRelationships = await persistence.getRelationships(entity.id)
    const existingRelationship = existingRelationships.find(
      (candidate) =>
        candidate.fromEntityId === relationship.fromEntityId &&
        candidate.toEntityId === relationship.toEntityId &&
        candidate.type === relationship.type,
    ) ?? null
    await persistence.upsertRelationship(reconcileCorporateRelationship({
      incoming: relationship,
      existing: existingRelationship,
      observedAt: input.observedAt,
    }))
  }

  return entity
}
