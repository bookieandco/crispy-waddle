import { describe, expect, it } from 'vitest';
import { spatialEvidenceHash } from './evidence-hash.js';
import { InMemorySpatialEvidenceStore } from './evidence-store.js';
import type { SpatialEvidence } from './evidence.js';

const unsignedEvidence: Omit<SpatialEvidence, 'integrity'> = {
  evidenceId: 'ev-1',
  observationId: 'obs-1',
  source: { provider: 'test', recordId: 'record-1', attribution: 'test' },
  timing: { observedAt: '2026-09-15T00:00:00Z', receivedAt: '2026-09-15T00:00:01Z' },
  coverage: { completeness: 'complete', coverage: 'known', freshness: 'fresh' },
  payload: { entity: { id: 'camera-1' }, position: null, attributes: {} },
  transformation: { adapter: 'test-adapter', adapterVersion: '1.0.0', normalized: true },
};

const evidence: SpatialEvidence = {
  ...unsignedEvidence,
  integrity: { contentHash: spatialEvidenceHash(unsignedEvidence) },
};

describe('InMemorySpatialEvidenceStore', () => {
  it('appends once and treats the same content hash as a duplicate', async () => {
    const store = new InMemorySpatialEvidenceStore();
    await expect(store.append(evidence)).resolves.toBe('APPENDED');
    await expect(store.append(structuredClone(evidence))).resolves.toBe('DUPLICATE');
    await expect(store.get('ev-1')).resolves.toEqual(evidence);
  });

  it('rejects a supplied hash that does not match the canonical evidence', async () => {
    const store = new InMemorySpatialEvidenceStore();
    await expect(store.append({ ...evidence, integrity: { contentHash: 'b'.repeat(64) } }))
      .rejects.toThrow('SPATIAL_EVIDENCE_CONTENT_HASH_MISMATCH');
  });

  it('rejects a different payload even when the original evidence id is reused', async () => {
    const store = new InMemorySpatialEvidenceStore();
    await store.append(evidence);
    const changed = { ...unsignedEvidence, payload: { ...unsignedEvidence.payload, attributes: { changed: true } } };
    await expect(store.append({ ...changed, integrity: { contentHash: spatialEvidenceHash(changed) } }))
      .rejects.toThrow('SPATIAL_EVIDENCE_ID_CONFLICT');
  });
});
