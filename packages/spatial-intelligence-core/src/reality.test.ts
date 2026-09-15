import { describe, expect, it } from 'vitest';
import { InMemorySpatialRealityStore, type RealityAdmission, type SpatialRealityCandidate } from './reality.js';

const candidate: SpatialRealityCandidate = {
  candidateId: 'candidate-1',
  entityId: 'aircraft-1',
  state: { lat: 33.94, lon: -118.4 },
  determination: 'observed',
  evidenceRefs: ['ev-1'],
  observationRefs: ['obs-1'],
  fusionRefs: [],
  createdAt: '2026-09-15T00:00:00Z',
  validFrom: '2026-09-15T00:00:00Z',
  validTo: null,
  limitations: [],
};

const admission: RealityAdmission = {
  admissionId: 'admission-1',
  candidateId: 'candidate-1',
  decision: 'ACCEPT',
  verifier: 'spatial-reality-v1',
  evidenceRefs: ['ev-1'],
  rationale: ['Evidence is present and temporally valid.'],
  createdAt: '2026-09-15T00:00:02Z',
};

describe('InMemorySpatialRealityStore', () => {
  it('keeps candidate creation separate from reality admission', async () => {
    const store = new InMemorySpatialRealityStore();
    await expect(store.appendCandidate(candidate)).resolves.toBe('APPENDED');
    await expect(store.getAdmissions(candidate.candidateId)).resolves.toEqual([]);
    await expect(store.appendAdmission(admission)).resolves.toBe('APPENDED');
    await expect(store.getAdmissions(candidate.candidateId)).resolves.toEqual([admission]);
  });

  it('rejects admission for an unknown candidate', async () => {
    const store = new InMemorySpatialRealityStore();
    await expect(store.appendAdmission(admission)).rejects.toThrow('SPATIAL_REALITY_CANDIDATE_NOT_FOUND');
  });

  it('requires evidence for verified candidates', async () => {
    const store = new InMemorySpatialRealityStore();
    await expect(store.appendCandidate({ ...candidate, determination: 'verified', evidenceRefs: [] }))
      .rejects.toThrow('SPATIAL_REALITY_VERIFIED_EVIDENCE_REQUIRED');
  });
});
