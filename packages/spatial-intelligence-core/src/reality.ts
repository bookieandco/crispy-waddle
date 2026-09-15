export type SpatialDetermination = 'observed' | 'corroborated' | 'verified' | 'derived';

export type SpatialRealityCandidate = {
  candidateId: string;
  entityId: string;
  state: Record<string, unknown>;
  determination: SpatialDetermination;
  evidenceRefs: string[];
  observationRefs: string[];
  fusionRefs: string[];
  createdAt: string;
  validFrom: string | null;
  validTo: string | null;
  limitations: string[];
};

export type RealityAdmissionDecision = 'ACCEPT' | 'REJECT' | 'DEFER' | 'SUPERSEDE';

export type RealityAdmission = {
  admissionId: string;
  candidateId: string;
  decision: RealityAdmissionDecision;
  verifier: string;
  evidenceRefs: string[];
  rationale: string[];
  createdAt: string;
};

export interface SpatialRealityStore {
  appendCandidate(candidate: SpatialRealityCandidate): Promise<'APPENDED' | 'DUPLICATE'>;
  appendAdmission(admission: RealityAdmission): Promise<'APPENDED' | 'DUPLICATE'>;
  getCandidate(candidateId: string): Promise<SpatialRealityCandidate | undefined>;
  getAdmissions(candidateId: string): Promise<RealityAdmission[]>;
}

function assertCandidate(candidate: SpatialRealityCandidate): void {
  if (!candidate.candidateId || !candidate.entityId) throw new Error('SPATIAL_REALITY_CANDIDATE_ID_REQUIRED');
  if (!candidate.createdAt) throw new Error('SPATIAL_REALITY_CANDIDATE_CREATED_AT_REQUIRED');
  if (candidate.determination === 'verified' && candidate.evidenceRefs.length === 0) {
    throw new Error('SPATIAL_REALITY_VERIFIED_EVIDENCE_REQUIRED');
  }
}

function assertAdmission(admission: RealityAdmission): void {
  if (!admission.admissionId || !admission.candidateId) throw new Error('SPATIAL_REALITY_ADMISSION_ID_REQUIRED');
  if (!admission.verifier) throw new Error('SPATIAL_REALITY_VERIFIER_REQUIRED');
  if (!admission.createdAt) throw new Error('SPATIAL_REALITY_ADMISSION_CREATED_AT_REQUIRED');
  if (!admission.rationale.length) throw new Error('SPATIAL_REALITY_ADMISSION_RATIONALE_REQUIRED');
}

/** Append-only reference store. It never promotes a candidate implicitly. */
export class InMemorySpatialRealityStore implements SpatialRealityStore {
  private readonly candidates = new Map<string, SpatialRealityCandidate>();
  private readonly admissions = new Map<string, RealityAdmission[]>();

  async appendCandidate(candidate: SpatialRealityCandidate): Promise<'APPENDED' | 'DUPLICATE'> {
    assertCandidate(candidate);
    if (this.candidates.has(candidate.candidateId)) return 'DUPLICATE';
    this.candidates.set(candidate.candidateId, structuredClone(candidate));
    return 'APPENDED';
  }

  async appendAdmission(admission: RealityAdmission): Promise<'APPENDED' | 'DUPLICATE'> {
    assertAdmission(admission);
    if (!this.candidates.has(admission.candidateId)) throw new Error('SPATIAL_REALITY_CANDIDATE_NOT_FOUND');
    const list = this.admissions.get(admission.candidateId) ?? [];
    if (list.some((item) => item.admissionId === admission.admissionId)) return 'DUPLICATE';
    list.push(structuredClone(admission));
    this.admissions.set(admission.candidateId, list);
    return 'APPENDED';
  }

  async getCandidate(candidateId: string): Promise<SpatialRealityCandidate | undefined> {
    const candidate = this.candidates.get(candidateId);
    return candidate ? structuredClone(candidate) : undefined;
  }

  async getAdmissions(candidateId: string): Promise<RealityAdmission[]> {
    return structuredClone(this.admissions.get(candidateId) ?? []);
  }
}
