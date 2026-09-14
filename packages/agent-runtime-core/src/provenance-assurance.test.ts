import { describe, expect, it } from 'vitest';
import { createArtifactIdentity, createProvenanceQuery, createProvenanceSnapshot, detectProvenanceDrift, validateProductionArtifact } from './provenance-assurance.js';

describe('provenance assurance', () => {
  it('creates a deterministic artifact identity and validates it', () => {
    const input = { artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'sha256:artifact', sourceHash: 'sha256:source', contractHash: 'sha256:contract' };
    const identity = createArtifactIdentity(input);
    expect(identity.provenanceHash).toHaveLength(64);
    expect(identity.identityHash).toHaveLength(64);
    expect(validateProductionArtifact(identity)).toBe('ARTIFACT_VERIFIED');
  });

  it('detects tampering in the identity binding', () => {
    const identity = createArtifactIdentity({ artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'sha256:artifact' });
    expect(validateProductionArtifact({ ...identity, artifactHash: 'sha256:tampered' })).toBe('CONTRADICTED');
  });

  it('traces provenance in both directions', () => {
    const snapshot = createProvenanceSnapshot([
      { id: 'source', type: 'source', hash: 's' },
      { id: 'build', type: 'build', hash: 'b' },
      { id: 'artifact', type: 'artifact', hash: 'a' },
      { id: 'deployment', type: 'deployment', hash: 'd' },
    ], [
      { from: 'source', to: 'build', type: 'DERIVED_FROM' },
      { from: 'build', to: 'artifact', type: 'BUILT_BY' },
      { from: 'artifact', to: 'deployment', type: 'DEPLOYED_AS' },
    ], 1);
    const query = createProvenanceQuery(snapshot);
    expect(query.traceBackward('deployment').map((node) => node.id)).toEqual(['source', 'build', 'artifact']);
    expect(query.traceForward('source').map((node) => node.id)).toEqual(['build', 'artifact', 'deployment']);
  });

  it('returns UNKNOWN when drift cannot be established', () => {
    const snapshot = createProvenanceSnapshot([], []);
    expect(detectProvenanceDrift('artifact', undefined, 'observed', snapshot).status).toBe('UNKNOWN');
  });

  it('reports downstream impact when provenance drifts', () => {
    const snapshot = createProvenanceSnapshot([
      { id: 'artifact', type: 'artifact', hash: 'a' },
      { id: 'deployment', type: 'deployment', hash: 'd' },
    ], [{ from: 'artifact', to: 'deployment', type: 'DEPLOYED_AS' }]);
    expect(detectProvenanceDrift('artifact', 'expected', 'observed', snapshot)).toMatchObject({ status: 'DRIFT', affectedNodeIds: ['deployment'] });
  });
});
