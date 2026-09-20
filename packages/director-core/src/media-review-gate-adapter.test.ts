import { describe, expect, it } from 'vitest';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage } from './creative-stage-graph.js';
import type { GeneratedAssetRecord } from './generation-assets.js';
import type { CreativeProvenance } from './creative-provenance.js';
import type { MediaQualityEvidence } from './media-quality-evidence.js';
import { evaluateDirectorMediaReviewGate } from './media-review-gate-adapter.js';

const run: ProductionRun = { id: 'run-1', projectId: 'project-1', status: 'review', createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:00:00Z', shotIds: ['shot-1'], gateIds: ['gate-1'] };
const gate: CreativeGate = { id: 'gate-1', runId: 'run-1', kind: 'rough_cut', decision: 'approved', requestedAt: '2026-09-09T00:00:00Z', decidedAt: '2026-09-09T00:01:00Z' };
const generationStage: CreativeStage = { id: 'generation-1', projectId: 'project-1', kind: 'generation', dependsOn: ['shotlist-1'], status: 'review', inputArtifactIds: ['shot-1'], outputArtifactIds: ['asset-1'], version: 2 };
const reviewStage: CreativeStage = { id: 'review-1', projectId: 'project-1', kind: 'review', dependsOn: ['generation-1'], status: 'review', inputArtifactIds: ['asset-1'], outputArtifactIds: [], version: 1 };
const provenance: CreativeProvenance = { projectId: 'project-1', storyboardBoardIds: ['board-1'], storyboardVersion: 3, generationStageId: 'generation-1', generationStageVersion: 2, generationJobId: 'job-1' };
const asset: GeneratedAssetRecord = { id: 'asset-1', projectId: 'project-1', generationJobId: 'job-1', providerId: 'provider-1', mediaType: 'image', uri: 'https://example.test/asset.png', sha256: 'asset-sha', createdAt: '2026-09-09T00:02:00Z', provenance };
const evidence: MediaQualityEvidence = { id: 'evidence-1', artifactId: 'asset-1', kind: 'image', status: 'pass', checkedAt: '2026-09-09T00:03:00Z', checker: 'quality-checker', metrics: { width: 1920, height: 1080 }, provenance, assetSha256: 'asset-sha' };

function input(overrides: Partial<Parameters<typeof evaluateDirectorMediaReviewGate>[0]> = {}) {
  return { run, gate, generationStage, reviewStage, asset, evidence: [evidence], expectedProvenance: provenance, ...overrides };
}

describe('evaluateDirectorMediaReviewGate', () => {
  it('allows an explicitly approved review with matching passing evidence', () => {
    expect(evaluateDirectorMediaReviewGate(input()).allowed).toBe(true);
  });

  it('blocks a quality failure even when the creative gate is approved', () => {
    const failed = { ...evidence, status: 'fail' as const };
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [failed] })).allowed).toBe(false);
  });

  it('allows a warning only when explicit review approval exists', () => {
    const warning = { ...evidence, status: 'warn' as const };
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [warning] })).allowed).toBe(true);
    expect(evaluateDirectorMediaReviewGate(input({ gate: { ...gate, decision: 'pending' } })).allowed).toBe(false);
  });

  it('blocks missing or mismatched evidence', () => {
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [] })).allowed).toBe(false);
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [{ ...evidence, kind: 'video' }] })).allowed).toBe(false);
  });

  it('blocks stale or non-reviewable generation state', () => {
    expect(evaluateDirectorMediaReviewGate(input({ generationStage: { ...generationStage, status: 'stale' } })).allowed).toBe(false);
  });

  it('blocks cross-project assets', () => {
    expect(evaluateDirectorMediaReviewGate(input({ asset: { ...asset, projectId: 'other-project' } })).allowed).toBe(false);
  });

  it('blocks replay of evidence from an older creative lineage', () => {
    const older = { ...provenance, storyboardVersion: 2 };
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [{ ...evidence, provenance: older }] })).allowed).toBe(false);
  });

  it('blocks an asset whose generation stage version is stale', () => {
    const stale = { ...provenance, generationStageVersion: 1 };
    expect(evaluateDirectorMediaReviewGate(input({ asset: { ...asset, provenance: stale } })).allowed).toBe(false);
  });

  it('blocks evidence for a different asset checksum', () => {
    expect(evaluateDirectorMediaReviewGate(input({ evidence: [{ ...evidence, assetSha256: 'other-sha' }] })).allowed).toBe(false);
  });
});
