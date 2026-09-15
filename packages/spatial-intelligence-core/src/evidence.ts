export type SpatialEvidenceSource = {
  provider: string;
  recordId: string | null;
  attribution: string | null;
};

export type SpatialEvidenceTiming = {
  observedAt: string | null;
  receivedAt: string;
};

export type SpatialEvidenceCoverage = {
  completeness: 'complete' | 'partial' | 'unknown';
  coverage: 'known' | 'partial' | 'unknown';
  freshness: 'fresh' | 'stale' | 'unknown';
};

export type SpatialEvidencePayload = {
  entity: Record<string, unknown>;
  position: Record<string, unknown> | null;
  attributes: Record<string, unknown>;
};

export type SpatialEvidenceTransformation = {
  adapter: string;
  adapterVersion: string;
  normalized: true;
};

export type SpatialEvidenceIntegrity = {
  contentHash: string;
};

/** Immutable evidence envelope. Evidence describes what a source supplied; it does not establish canonical reality. */
export type SpatialEvidence = {
  evidenceId: string;
  observationId: string;
  source: SpatialEvidenceSource;
  timing: SpatialEvidenceTiming;
  coverage: SpatialEvidenceCoverage;
  payload: SpatialEvidencePayload;
  transformation: SpatialEvidenceTransformation;
  integrity: SpatialEvidenceIntegrity;
};

/** Canonical serialization used as the input to content-addressed hashing. */
export function canonicalSpatialEvidenceInput(evidence: Omit<SpatialEvidence, 'integrity'>): string {
  return stableSerialize(evidence);
}

/** Deterministic JSON serialization: object keys are sorted recursively; arrays retain source order. */
export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(',')}}`;
}

export function assertSpatialEvidenceShape(evidence: SpatialEvidence): void {
  if (!evidence.evidenceId || !evidence.observationId) throw new Error('SPATIAL_EVIDENCE_ID_REQUIRED');
  if (!evidence.source.provider) throw new Error('SPATIAL_EVIDENCE_PROVIDER_REQUIRED');
  if (!evidence.timing.receivedAt) throw new Error('SPATIAL_EVIDENCE_RECEIVED_AT_REQUIRED');
  if (evidence.transformation.normalized !== true) throw new Error('SPATIAL_EVIDENCE_MUST_BE_NORMALIZED');
  if (!/^[a-f0-9]{64}$/.test(evidence.integrity.contentHash)) {
    throw new Error('SPATIAL_EVIDENCE_CONTENT_HASH_INVALID');
  }
}
