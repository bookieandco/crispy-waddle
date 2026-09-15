import type { SpatialRealityCandidate, RealityAdmission, SpatialRealityStore } from './reality.js';

export type SpatialRealitySqlClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
};

export type PostgresSpatialRealityStoreOptions = { client: SpatialRealitySqlClient; candidateTableName?: string; admissionTableName?: string };

type CandidateRow = {
  candidate_id: string; entity_id: string; state: Record<string, unknown>; determination: SpatialRealityCandidate['determination'];
  evidence_refs: string[]; observation_refs: string[]; fusion_refs: string[]; created_at: string; valid_from: string | null; valid_to: string | null; limitations: string[];
};
type AdmissionRow = { admission_id: string; candidate_id: string; decision: RealityAdmission['decision']; verifier: string; evidence_refs: string[]; rationale: string[]; created_at: string };

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('SPATIAL_REALITY_TABLE_INVALID');
  return value;
}
function candidateFromRow(row: CandidateRow): SpatialRealityCandidate {
  return { candidateId: row.candidate_id, entityId: row.entity_id, state: row.state, determination: row.determination, evidenceRefs: row.evidence_refs, observationRefs: row.observation_refs, fusionRefs: row.fusion_refs, createdAt: row.created_at, validFrom: row.valid_from, validTo: row.valid_to, limitations: row.limitations };
}
function admissionFromRow(row: AdmissionRow): RealityAdmission {
  return { admissionId: row.admission_id, candidateId: row.candidate_id, decision: row.decision, verifier: row.verifier, evidenceRefs: row.evidence_refs, rationale: row.rationale, createdAt: row.created_at };
}

export class PostgresSpatialRealityStore implements SpatialRealityStore {
  private readonly client: SpatialRealitySqlClient;
  private readonly candidates: string;
  private readonly admissions: string;
  constructor(options: PostgresSpatialRealityStoreOptions) {
    this.client = options.client;
    this.candidates = identifier(options.candidateTableName ?? 'jhadina_spatial_reality_candidates');
    this.admissions = identifier(options.admissionTableName ?? 'jhadina_spatial_reality_admissions');
  }
  async appendCandidate(candidate: SpatialRealityCandidate): Promise<'APPENDED' | 'DUPLICATE'> {
    const result = await this.client.query(
      `INSERT INTO ${this.candidates} (candidate_id,entity_id,state,determination,evidence_refs,observation_refs,fusion_refs,created_at,valid_from,valid_to,limitations) VALUES ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb) ON CONFLICT (candidate_id) DO NOTHING RETURNING candidate_id`,
      [candidate.candidateId, candidate.entityId, JSON.stringify(candidate.state), candidate.determination, JSON.stringify(candidate.evidenceRefs), JSON.stringify(candidate.observationRefs), JSON.stringify(candidate.fusionRefs), candidate.createdAt, candidate.validFrom, candidate.validTo, JSON.stringify(candidate.limitations)],
    );
    return result.rows[0] ? 'APPENDED' : 'DUPLICATE';
  }
  async appendAdmission(admission: RealityAdmission): Promise<'APPENDED' | 'DUPLICATE'> {
    const result = await this.client.query(
      `INSERT INTO ${this.admissions} (admission_id,candidate_id,decision,verifier,evidence_refs,rationale,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) ON CONFLICT (admission_id) DO NOTHING RETURNING admission_id`,
      [admission.admissionId, admission.candidateId, admission.decision, admission.verifier, JSON.stringify(admission.evidenceRefs), JSON.stringify(admission.rationale), admission.createdAt],
    );
    if (result.rows[0]) return 'APPENDED';
    return 'DUPLICATE';
  }
  async getCandidate(candidateId: string): Promise<SpatialRealityCandidate | undefined> {
    const result = await this.client.query<CandidateRow>(`SELECT candidate_id,entity_id,state,determination,evidence_refs,observation_refs,fusion_refs,created_at,valid_from,valid_to,limitations FROM ${this.candidates} WHERE candidate_id=$1 LIMIT 1`, [candidateId]);
    return result.rows[0] ? candidateFromRow(result.rows[0]) : undefined;
  }
  async getAdmissions(candidateId: string): Promise<RealityAdmission[]> {
    const result = await this.client.query<AdmissionRow>(`SELECT admission_id,candidate_id,decision,verifier,evidence_refs,rationale,created_at FROM ${this.admissions} WHERE candidate_id=$1 ORDER BY created_at ASC`, [candidateId]);
    return result.rows.map(admissionFromRow);
  }
}
