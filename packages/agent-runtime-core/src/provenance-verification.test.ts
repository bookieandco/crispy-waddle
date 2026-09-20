import { describe, expect, it } from 'vitest';
import { createArtifactIdentity, createBuildProvenance, createProvenanceSnapshot } from './provenance-assurance.js';
import { verifyArtifactProvenance, verifyBuildProvenance } from './provenance-verification.js';

describe('provenance verification phase B', () => {
  it('verifies a graph-bound artifact', () => {
    const identity = createArtifactIdentity({ artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'artifact-hash', sourceHash: 'source-hash' });
    const snapshot = createProvenanceSnapshot([{ id: 'artifact:1', type: 'artifact', hash: 'artifact-hash' }], []);
    expect(verifyArtifactProvenance(identity, snapshot)).toMatchObject({ status: 'ARTIFACT_VERIFIED', verified: true });
  });

  it('rejects an artifact whose graph hash disagrees', () => {
    const identity = createArtifactIdentity({ artifactId: 'artifact:1', artifactType: 'runtime', artifactHash: 'artifact-hash' });
    const snapshot = createProvenanceSnapshot([{ id: 'artifact:1', type: 'artifact', hash: 'different-hash' }], []);
    const result = verifyArtifactProvenance(identity, snapshot);
    expect(result.status).toBe('CONTRADICTED');
    expect(result.issues.map((issue) => issue.code)).toContain('ARTIFACT_NODE_HASH_MISMATCH');
  });

  it('verifies build provenance when outputs and source evidence are represented', () => {
    const buildInput = {
      buildId: 'build:1',
      sourceRefs: ['source:1'],
      inputArtifacts: [],
      outputArtifacts: ['artifact:1'],
      testResults: ['test:1'],
      securityResults: ['scan:1'],
      controlEpoch: 2,
    };
    const build = createBuildProvenance(buildInput);
    const snapshot = createProvenanceSnapshot([
      { id: 'source:1', type: 'source', hash: 'source' },
      { id: 'artifact:1', type: 'artifact', hash: 'artifact' },
    ], []);
    expect(verifyBuildProvenance({ build, snapshot })).toMatchObject({ status: 'BUILD_VERIFIED', verified: true });
  });

  it('blocks build provenance with missing output artifacts', () => {
    const build = createBuildProvenance({
      buildId: 'build:1', sourceRefs: ['source:1'], inputArtifacts: [], outputArtifacts: ['artifact:missing'],
      testResults: ['test:1'], securityResults: [],
    });
    const snapshot = createProvenanceSnapshot([{ id: 'source:1', type: 'source', hash: 'source' }], []);
    const result = verifyBuildProvenance({ build, snapshot });
    expect(result.status).toBe('CONTRADICTED');
    expect(result.issues.map((issue) => issue.code)).toContain('BUILD_OUTPUT_ARTIFACT_MISSING');
  });
});
