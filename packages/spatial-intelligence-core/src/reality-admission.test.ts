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

  it('does not admit a synthetic or fallback-only candidate', () => {
    expect(evaluateSpatialRealityAdmission({
      candidate: { ...candidate, evidenceRefs: ['ev-fallback'] },
      verifier: 'test-v1', evidenceAvailable: new Set(['ev-fallback']),
      fallbackEvidenceRefs: new Set(['ev-fallback']), createdAt: '2026-09-15T00:00:01Z',
    })).toMatchObject({ decision: 'DEFER', evidenceRefs: ['ev-fallback'] });
  });

  it('does not admit a Street View fallback-only candidate', () => {
    expect(evaluateSpatialRealityAdmission({
      candidate: { ...candidate, evidenceRefs: ['ev-street-view'] },
      verifier: 'test-v1', evidenceAvailable: new Set(['ev-street-view']),
      fallbackEvidenceRefs: new Set(['ev-street-view']), createdAt: '2026-09-15T00:00:01Z',
    })).toMatchObject({ decision: 'DEFER' });
  });

  it('allows fallback evidence to participate when independently supplied non-fallback evidence is present', () => {
    expect(evaluateSpatialRealityAdmission({
      candidate, verifier: 'test-v1', evidenceAvailable: new Set(['ev-1', 'ev-2']),
      fallbackEvidenceRefs: new Set(['ev-2']), createdAt: '2026-09-15T00:00:01Z',
    })).toMatchObject({ decision: 'ACCEPT', evidenceRefs: ['ev-1', 'ev-2'] });
  });
});
