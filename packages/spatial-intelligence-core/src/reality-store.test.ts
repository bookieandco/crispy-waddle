import { describe, expect, it } from 'vitest';
import { PostgresSpatialRealityStore, type SpatialRealitySqlClient } from './postgres-reality-store.js';

const candidate = { candidateId: 'c1', entityId: 'e1', state: { x: 1 }, determination: 'observed' as const, evidenceRefs: ['ev1'], observationRefs: ['o1'], fusionRefs: [], createdAt: '2026-09-15T00:00:00Z', validFrom: null, validTo: null, limitations: [] };
const admission = { admissionId: 'a1', candidateId: 'c1', decision: 'ACCEPT' as const, verifier: 'v1', evidenceRefs: ['ev1'], rationale: ['supported'], createdAt: '2026-09-15T00:00:01Z' };

function client(rows: unknown[] = []): SpatialRealitySqlClient {
  return {
    async query<T = Record<string, unknown>>() {
      return { rows: rows as T[] };
    },
  };
}

describe('PostgresSpatialRealityStore', () => {
  it('uses conflict-safe append operations', async () => {
    const queries: string[] = [];
    const db: SpatialRealitySqlClient = {
      async query<T = Record<string, unknown>>(text: string) {
        queries.push(text);
        return { rows: [{} as T] };
      },
    };
    const store = new PostgresSpatialRealityStore({ client: db });
    await store.appendCandidate(candidate);
    await store.appendAdmission(admission);
    expect(queries[0]).toContain('ON CONFLICT (candidate_id) DO NOTHING');
    expect(queries[1]).toContain('ON CONFLICT (admission_id) DO NOTHING');
  });

  it('reads candidate and admission history without mutation', async () => {
    const candidateRow = {
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
    };
    const store = new PostgresSpatialRealityStore({ client: client([candidateRow]) });
    await expect(store.getCandidate('c1')).resolves.toEqual(candidate);
  });
});
