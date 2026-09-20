import {
  stableSerialize,
  type RealityAdmission,
  type SpatialRealityCandidate,
  type SpatialRealityStore,
} from '@jhadina/spatial-intelligence-core'
import { createServiceRoleClient } from '../supabase/service-role'

type CandidateRow = {
  candidate_id: string
  entity_id: string
  state: Record<string, unknown>
  determination: SpatialRealityCandidate['determination']
  evidence_refs: string[]
  observation_refs: string[]
  fusion_refs: string[]
  created_at: string
  valid_from: string | null
  valid_to: string | null
  limitations: string[]
}

type AdmissionRow = {
  admission_id: string
  candidate_id: string
  decision: RealityAdmission['decision']
  verifier: string
  evidence_refs: string[]
  rationale: string[]
  created_at: string
}

const candidateFromRow = (row: CandidateRow): SpatialRealityCandidate => ({
  candidateId: row.candidate_id,
  entityId: row.entity_id,
  state: row.state,
  determination: row.determination,
  evidenceRefs: row.evidence_refs,
  observationRefs: row.observation_refs,
  fusionRefs: row.fusion_refs,
  createdAt: row.created_at,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  limitations: row.limitations,
})

const admissionFromRow = (row: AdmissionRow): RealityAdmission => ({
  admissionId: row.admission_id,
  candidateId: row.candidate_id,
  decision: row.decision,
  verifier: row.verifier,
  evidenceRefs: row.evidence_refs,
  rationale: row.rationale,
  createdAt: row.created_at,
})

export function createSupabaseSpatialRealityStore(): SpatialRealityStore | undefined {
  const client = createServiceRoleClient()
  if (!client) return undefined

  return {
    async appendCandidate(candidate) {
      const row: CandidateRow = {
        candidate_id: candidate.candidateId,
        entity_id: candidate.entityId,
        state: candidate.state,
        determination: candidate.determination,
        evidence_refs: candidate.evidenceRefs,
        observation_refs: candidate.observationRefs,
        fusion_refs: candidate.fusionRefs,
        created_at: candidate.createdAt,
        valid_from: candidate.validFrom,
        valid_to: candidate.validTo,
        limitations: candidate.limitations,
      }
      const { error } = await client.from('jhadina_spatial_reality_candidates').insert(row)
      if (!error) return 'APPENDED'
      if (error.code !== '23505') throw new Error(`SPATIAL_REALITY_CANDIDATE_APPEND_FAILED:${error.message}`)
      const existing = await this.getCandidate(candidate.candidateId)
      if (!existing) throw new Error('SPATIAL_REALITY_CANDIDATE_DUPLICATE_READ_FAILED')
      if (stableSerialize(existing) !== stableSerialize(candidate)) throw new Error('SPATIAL_REALITY_CANDIDATE_ID_CONFLICT')
      return 'DUPLICATE'
    },

    async appendAdmission(admission) {
      const row: AdmissionRow = {
        admission_id: admission.admissionId,
        candidate_id: admission.candidateId,
        decision: admission.decision,
        verifier: admission.verifier,
        evidence_refs: admission.evidenceRefs,
        rationale: admission.rationale,
        created_at: admission.createdAt,
      }
      const { error } = await client.from('jhadina_spatial_reality_admissions').insert(row)
      if (!error) return 'APPENDED'
      if (error.code !== '23505') throw new Error(`SPATIAL_REALITY_ADMISSION_APPEND_FAILED:${error.message}`)
      const admissions = await this.getAdmissions(admission.candidateId)
      const existing = admissions.find((item) => item.admissionId === admission.admissionId)
      if (!existing) throw new Error('SPATIAL_REALITY_ADMISSION_DUPLICATE_READ_FAILED')
      if (stableSerialize(existing) !== stableSerialize(admission)) throw new Error('SPATIAL_REALITY_ADMISSION_ID_CONFLICT')
      return 'DUPLICATE'
    },

    async getCandidate(candidateId) {
      const { data, error } = await client
        .from('jhadina_spatial_reality_candidates')
        .select('candidate_id,entity_id,state,determination,evidence_refs,observation_refs,fusion_refs,created_at,valid_from,valid_to,limitations')
        .eq('candidate_id', candidateId)
        .maybeSingle()
      if (error) throw new Error(`SPATIAL_REALITY_CANDIDATE_READ_FAILED:${error.message}`)
      return data ? candidateFromRow(data as CandidateRow) : undefined
    },

    async getAdmissions(candidateId) {
      const { data, error } = await client
        .from('jhadina_spatial_reality_admissions')
        .select('admission_id,candidate_id,decision,verifier,evidence_refs,rationale,created_at')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`SPATIAL_REALITY_ADMISSION_READ_FAILED:${error.message}`)
      return (data ?? []).map((row) => admissionFromRow(row as AdmissionRow))
    },
  }
}
