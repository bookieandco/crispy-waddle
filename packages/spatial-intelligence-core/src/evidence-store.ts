import type { SpatialEvidence } from './evidence.js';

export interface SpatialEvidenceStore {
  append(evidence: SpatialEvidence): Promise<'APPENDED' | 'DUPLICATE'>;
  get(evidenceId: string): Promise<SpatialEvidence | undefined>;
}

/** In-memory reference implementation. Persistence adapters must preserve append-only semantics. */
export class InMemorySpatialEvidenceStore implements SpatialEvidenceStore {
  private readonly byId = new Map<string, SpatialEvidence>();
  private readonly byHash = new Map<string, string>();

  async append(evidence: SpatialEvidence): Promise<'APPENDED' | 'DUPLICATE'> {
    const existingId = this.byHash.get(evidence.integrity.contentHash);
    if (existingId) return 'DUPLICATE';
    if (this.byId.has(evidence.evidenceId)) {
      throw new Error('SPATIAL_EVIDENCE_ID_CONFLICT');
    }
    const frozen = structuredClone(evidence);
    this.byId.set(evidence.evidenceId, frozen);
    this.byHash.set(evidence.integrity.contentHash, evidence.evidenceId);
    return 'APPENDED';
  }

  async get(evidenceId: string): Promise<SpatialEvidence | undefined> {
    const evidence = this.byId.get(evidenceId);
    return evidence ? structuredClone(evidence) : undefined;
  }
}
