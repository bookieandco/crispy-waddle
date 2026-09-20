import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  createArtifactIdentity,
  createBuildProvenance,
  createProvenanceQuery,
  createProvenanceSnapshot,
  detectProvenanceDrift,
  sha256,
  traceProvenance,
  validateProductionArtifact,
  validateProvenanceGraph,
} from './provenance-assurance.js';

describe('provenance assurance phase A', () => {
  it('canonicalizes object keys deterministically', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
    expect(canonicalize([2, 1])).not.toBe(canonicalize([1, 2]));
  });

  it('creates a deterministic artifact identity and validates it', () => {
    const identity = createArtifactIdentity({
      artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'sha256:artifact',
      sourceHash: 'sha256:source', contractHash: 'sha256:contract', semanticHash: 'sha256:semantic',
    });
    expect(identity.provenanceHash).toHaveLength(64);
    expect(identity.identityHash).toHaveLength(64);
    expect(validateProductionArtifact(identity)).toBe('ARTIFACT_VERIFIED');
  });

  it('detects tampering in the identity binding', () => {
    const identity = createArtifactIdentity({ artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'sha256:artifact' });
    expect(validateProductionArtifact({ ...identity, artifactHash: 'sha256:tampered' })).toBe('CONTRADICTED');
  });

  it('creates deterministic build provenance', () => {
    const input = {
      buildId: 'build:1', sourceRefs: ['source:1'], sourceCommit: 'abc',
      inputArtifacts: ['artifact:input'], outputArtifacts: ['artifact:output'],
      testResults: ['test:1'], securityResults: ['scan:1'], controlEpoch: 4,
    };
    const a = createBuildProvenance(input);
    const b = createBuildProvenance({ ...input });
    expect(a.provenanceHash).toBe(b.provenanceHash);
    expect(a.provenanceHash).toHaveLength(64);
  });

  it('creates and validates a canonical provenance snapshot', () => {
    const snapshot = createProvenanceSnapshot([
      { id: 'deployment', type: 'deployment', hash: 'd' },
      { id: 'source', type: 'source', hash: 's' },
    ], [{ from: 'source', to: 'deployment', type: 'DERIVED_FROM' }], 7);
    expect(snapshot.nodes.map((n) => n.id)).toEqual(['deployment', 'source']);
    expect(snapshot.controlEpoch).toBe(7);
    expect(validateProvenanceGraph(snapshot)).toMatchObject({ valid: true });
  });

  it('rejects a tampered graph hash and missing edge nodes', () => {
    const snapshot = createProvenanceSnapshot([{ id: 'source', type: 'source', hash: 's' }], [], 1);
    expect(validateProvenanceGraph({ ...snapshot, graphHash: 'tampered' }).valid).toBe(false);
    expect(validateProvenanceGraph({
      ...snapshot,
      edges: [{ from: 'source', to: 'missing', type: 'DERIVED_FROM' }],
    }).errors).toContain('MISSING_EDGE_TARGET:missing');
  });

  it('traces provenance in both directions', () => {
    const snapshot = createProvenanceSnapshot([
      { id: 'source', type: 'source', hash: 's' }, { id: 'build', type: 'build', hash: 'b' },
      { id: 'artifact', type: 'artifact', hash: 'a' }, { id: 'deployment', type: 'deployment', hash: 'd' },
    ], [
      { from: 'source', to: 'build', type: 'DERIVED_FROM' },
      { from: 'build', to: 'artifact', type: 'BUILT_BY' },
      { from: 'artifact', to: 'deployment', type: 'DEPLOYED_AS' },
    ], 1);
    const query = createProvenanceQuery(snapshot);
    expect(traceProvenance(snapshot, 'deployment', 'backward').map((node) => node.id)).toEqual(['source', 'build', 'artifact']);
    expect(traceProvenance(snapshot, 'source', 'forward').map((node) => node.id)).toEqual(['build', 'artifact', 'deployment']);
    expect(query.findCauses('deployment').map((node) => node.id)).toEqual(['source', 'build', 'artifact']);
    expect(query.findDependents('source').map((node) => node.id)).toEqual(['build', 'artifact', 'deployment']);
  });

  it('returns UNKNOWN when drift cannot be established', () => {
    const snapshot = createProvenanceSnapshot([], []);
    expect(detectProvenanceDrift('artifact', undefined, 'observed', snapshot).status).toBe('UNKNOWN');
  });

  it('reports downstream impact when provenance drifts', () => {
    const snapshot = createProvenanceSnapshot([
      { id: 'artifact', type: 'artifact', hash: 'a' }, { id: 'deployment', type: 'deployment', hash: 'd' },
    ], [{ from: 'artifact', to: 'deployment', type: 'DEPLOYED_AS' }]);
    expect(detectProvenanceDrift('artifact', 'expected', 'observed', snapshot)).toMatchObject({ status: 'DRIFT', affectedNodeIds: ['deployment'] });
  });
});
