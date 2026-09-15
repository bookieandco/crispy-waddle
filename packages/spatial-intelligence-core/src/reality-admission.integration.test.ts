import { describe, expect, it } from 'vitest';
import { evaluateSpatialRealityAdmission } from './reality-admission.js';

describe('SPATIAL-04 integration boundary', () => {
  it('never accepts an evidence-free candidate', () => {
    const result = evaluateSpatialRealityAdmission({
      candidate: { candidateId: 'c', entityId: 'e', state: {}, determination: 'derived', evidenceRefs: [], observationRefs: [], fusionRefs: [], createdAt: '2026-09-15T00:00:00Z', validFrom: null, validTo: null, limitations: [] },
      verifier: 'integration', evidenceAvailable: new Set(), createdAt: '2026-09-15T00:00:01Z',
    });
    expect(result.decision).toBe('DEFER');
  });
});
