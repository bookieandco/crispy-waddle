import { describe, expect, it } from 'vitest';
import { evaluateDirectorMediaReviewGate } from './media-review-gate-adapter.js';
import type { DirectorMediaReviewGateInput } from './media-review-gate-adapter.js';

const provenance = {
  projectId: 'p',
  storyboardBoardIds: ['board-1'],
  storyboardVersion: 2,
  generationStageId: 'generation-1',
  generationStageVersion: 3,
  generationJobId: 'director:p:take:take-1',
};

function validInput(): DirectorMediaReviewGateInput {
  return {
    run: { id: 'run-1', projectId: 'p', status: 'review', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z', shotIds: ['shot-1'], gateIds: ['review-gate'] },
    gate: { id: 'review-gate', runId: 'run-1', kind: 'rough_cut', decision: 'approved', requestedAt: '2026-09-20T00:00:00Z' },
    generationStage: { id: 'generation-1', projectId: 'p', kind: 'generation', dependsOn: [], status: 'review', inputArtifactIds: [], outputArtifactIds: ['asset-1'], version: 3 },
    reviewStage: { id: 'review-1', projectId: 'p', kind: 'review', dependsOn: ['generation-1'], status: 'review', inputArtifactIds: ['asset-1'], outputArtifactIds: [], version: 1 },
    asset: { id: 'asset-1', generationJobId: provenance.generationJobId, providerId: 'provider', providerAssetId: 'remote-1', projectId: 'p', mediaType: 'video', uri: 'https://example.invalid/a.mp4', sha256: 'abc', provenance, createdAt: '2026-09-20T00:00:00Z' },
    evidence: [{ id: 'e-1', artifactId: 'asset-1', kind: 'video', status: 'pass', checkedAt: '2026-09-20T00:01:00Z', checker: 'qc', metrics: {}, provenance, assetSha256: 'abc' }],
    expectedProvenance: provenance,
  };
}

describe('Director production media review authority', () => {
  it('accepts an explicitly approved asset with matching evidence and provenance', () => {
    expect(evaluateDirectorMediaReviewGate(validInput()).allowed).toBe(true);
  });

  it('rejects returned media with forged provenance', () => {
    const input = validInput();
    input.asset = { ...input.asset, provenance: { ...provenance, storyboardVersion: 999 } };
    expect(evaluateDirectorMediaReviewGate(input).allowed).toBe(false);
  });

  it('rejects quality failures even when creative approval exists', () => {
    const input = validInput();
    input.evidence = input.evidence.map((e) => ({ ...e, status: 'fail' }));
    expect(evaluateDirectorMediaReviewGate(input).allowed).toBe(false);
  });

  it('rejects review without explicit approval', () => {
    const input = validInput();
    input.gate = { ...input.gate, decision: 'changes_requested' };
    expect(evaluateDirectorMediaReviewGate(input).allowed).toBe(false);
  });
});
