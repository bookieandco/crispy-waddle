import {
  assertSpatialEvidenceShape,
  spatialEvidenceHash,
  type SpatialEvidence,
  type SpatialEvidenceStore,
} from '@jhadina/spatial-intelligence-core'
import { createServiceRoleClient } from '../supabase/service-role'

type EvidenceRow = {
  evidence_id: string
  observation_id: string
  provider: string
  record_id: string | null
  attribution: string | null
  observed_at: string | null
  received_at: string
  completeness: SpatialEvidence['coverage']['completeness']
  coverage: SpatialEvidence['coverage']['coverage']
  freshness: SpatialEvidence['coverage']['freshness']
  payload: SpatialEvidence['payload']
  adapter: string
  adapter_version: string
  content_hash: string
}

const withoutIntegrity = (evidence: SpatialEvidence): Omit<SpatialEvidence, 'integrity'> => {
  const { integrity: _integrity, ...rest } = evidence
  return rest
}

const fromRow = (row: EvidenceRow): SpatialEvidence => ({
  evidenceId: row.evidence_id,
  observationId: row.observation_id,
  source: { provider: row.provider, recordId: row.record_id, attribution: row.attribution },
  timing: { observedAt: row.observed_at, receivedAt: row.received_at },
  coverage: { completeness: row.completeness, coverage: row.coverage, freshness: row.freshness },
  payload: row.payload,
  transformation: { adapter: row.adapter, adapterVersion: row.adapter_version, normalized: true },
  integrity: { contentHash: row.content_hash },
})

/** Server-only durable evidence adapter over the existing service-role Supabase client. */
export function createSupabaseSpatialEvidenceStore(): SpatialEvidenceStore | undefined {
  const client = createServiceRoleClient()
  if (!client) return undefined

  return {
    async append(evidence) {
      assertSpatialEvidenceShape(evidence)
      if (spatialEvidenceHash(withoutIntegrity(evidence)) !== evidence.integrity.contentHash) throw new Error('SPATIAL_EVIDENCE_CONTENT_HASH_MISMATCH')
      const row: EvidenceRow = {
        evidence_id: evidence.evidenceId,
        observation_id: evidence.observationId,
        provider: evidence.source.provider,
        record_id: evidence.source.recordId,
        attribution: evidence.source.attribution,
        observed_at: evidence.timing.observedAt,
        received_at: evidence.timing.receivedAt,
        completeness: evidence.coverage.completeness,
        coverage: evidence.coverage.coverage,
        freshness: evidence.coverage.freshness,
        payload: evidence.payload,
        adapter: evidence.transformation.adapter,
        adapter_version: evidence.transformation.adapterVersion,
        content_hash: evidence.integrity.contentHash,
      }
      const { error } = await client.from('jhadina_spatial_evidence').insert(row)
      if (!error) return 'APPENDED'
      if (error.code === '23505') {
        const { data, error: readError } = await client
          .from('jhadina_spatial_evidence')
          .select('evidence_id')
          .eq('content_hash', evidence.integrity.contentHash)
          .maybeSingle()
        if (readError) throw new Error(`SPATIAL_EVIDENCE_DUPLICATE_READ_FAILED:${readError.message}`)
        if (data?.evidence_id) return 'DUPLICATE'
        throw new Error('SPATIAL_EVIDENCE_ID_CONFLICT')
      }
      throw new Error(`SPATIAL_EVIDENCE_APPEND_FAILED:${error.message}`)
    },

    async get(evidenceId) {
      const { data, error } = await client
        .from('jhadina_spatial_evidence')
        .select('evidence_id,observation_id,provider,record_id,attribution,observed_at,received_at,completeness,coverage,freshness,payload,adapter,adapter_version,content_hash')
        .eq('evidence_id', evidenceId)
        .maybeSingle()
      if (error) throw new Error(`SPATIAL_EVIDENCE_READ_FAILED:${error.message}`)
      return data ? fromRow(data as EvidenceRow) : undefined
    },
  }
}
