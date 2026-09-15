import { describe, expect, it } from 'vitest';
import { evaluateSpatialRealityAdmission } from './reality-admission.js';
import type { SpatialRealityCandidate } from './reality.js';

const candidate: SpatialRealityCandidate = {
  candidateId: 'candidate-1', entityId: 'vehicle-1', state: { lat: 1, lon: 2 },
  determination: 'corroborated', evidenceRefs: ['ev-1', 'ev-2'], observationRefs: ['obs-1'],
  fusionRefs: [], createdAt: '2026-09-15T00:00:00Z', validFrom: null, validTo: null, limitations: [],
};

describe('evaluateSpatialRealityAdmission', () => {
  it('accepts only when all referenced evidence is available', () => {
    expect(evaluateSpatialRealityAdmission({ candidate, verifier: 'test-v1', evidenceAvailable: new Set(['ev-1', 'ev-2']), createdAt: '2026-09-15T00:00:01Z' })).toMatchObject({ decision: 'ACCEPT' });
  });

  it('defers when evidence is missing', () => {
    expect(evaluateSpatialRealityAdmission({ candidate, verifier: 'test-v1', evidenceAvailable: new Set(['ev-1']), createdAt: '2026-09-15T00:00:01Z' })).toMatchObject({ decision: 'DEFER', evidenceRefs: ['ev-1'] });
  });
});
