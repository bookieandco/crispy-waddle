import { createServiceRoleClient } from "../supabase/service-role"

export type CorporateEntityRecord = {
  canonicalKey: string
  legalName: string
  jurisdiction?: string
  entityNumber?: string
  status?: string
  formedAt?: string
  source: string
  sourceReference: string
  metadata?: Record<string, unknown>
}

export type CorporateEvidenceRecord = {
  source: string
  sourceReference: string
  evidenceType?: string
  fingerprint: string
  observedAt?: string
  metadata?: Record<string, unknown>
}

export type CorporateRelationshipRecord = {
  fromEntityId: string
  toEntityId: string
  relationshipType: string
  confidence: number
  source: string
  sourceReference: string
  evidenceIds?: string[]
  observedAt?: string
  metadata?: Record<string, unknown>
}

/** Durable application boundary for OCE-6 corporate intelligence persistence. */
export class SupabaseCorporateIntelligenceRepository {
  async upsertEntity(input: CorporateEntityRecord) {
    const client = createServiceRoleClient()
    if (!client) throw new Error("Supabase service-role configuration is missing")

    const { data, error } = await client
      .from("corporate_intelligence_entities")
      .upsert(
        {
          canonical_key: input.canonicalKey,
          legal_name: input.legalName,
          jurisdiction: input.jurisdiction ?? null,
          entity_number: input.entityNumber ?? null,
          status: input.status ?? null,
          formed_at: input.formedAt ?? null,
          source: input.source,
          source_reference: input.sourceReference,
          last_seen_at: new Date().toISOString(),
          metadata: input.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "canonical_key" },
      )
      .select("*")
      .single()

    if (error) throw new Error(`Corporate entity persistence failed: ${error.message}`)
    return data
  }

  async addEvidence(entityId: string, input: CorporateEvidenceRecord) {
    const client = createServiceRoleClient()
    if (!client) throw new Error("Supabase service-role configuration is missing")

    const { data, error } = await client
      .from("corporate_intelligence_evidence")
      .upsert(
        {
          entity_id: entityId,
          source: input.source,
          source_reference: input.sourceReference,
          evidence_type: input.evidenceType ?? "corporate_record",
          fingerprint: input.fingerprint,
          observed_at: input.observedAt ?? new Date().toISOString(),
          metadata: input.metadata ?? {},
        },
        { onConflict: "entity_id,fingerprint" },
      )
      .select("*")
      .single()

    if (error) throw new Error(`Corporate evidence persistence failed: ${error.message}`)
    return data
  }

  async addRelationship(input: CorporateRelationshipRecord) {
    const client = createServiceRoleClient()
    if (!client) throw new Error("Supabase service-role configuration is missing")

    const { data, error } = await client
      .from("corporate_intelligence_relationships")
      .upsert(
        {
          from_entity_id: input.fromEntityId,
          to_entity_id: input.toEntityId,
          relationship_type: input.relationshipType,
          confidence: input.confidence,
          source: input.source,
          source_reference: input.sourceReference,
          evidence_ids: input.evidenceIds ?? [],
          observed_at: input.observedAt ?? new Date().toISOString(),
          metadata: input.metadata ?? {},
        },
        {
          onConflict:
            "from_entity_id,to_entity_id,relationship_type,source,source_reference",
        },
      )
      .select("*")
      .single()

    if (error) throw new Error(`Corporate relationship persistence failed: ${error.message}`)
    return data
  }
}
