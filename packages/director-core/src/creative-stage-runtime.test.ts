import { describe, expect, it } from 'vitest';
import type { CreativeStageGraph, StageRun } from './creative-stage-graph';
import { applyStageChange, reconcileStageRun } from './creative-stage-runtime';

const graph: CreativeStageGraph = {
  version: '1.0',
  stages: [
    { id: 'script', name: 'Script', upstreamStageIds: [], artifactKinds: ['script'] },
    { id: 'assets', name: 'Assets', upstreamStageIds: ['script'], artifactKinds: ['character'] },
    { id: 'storyboard', name: 'Storyboard', upstreamStageIds: ['assets'], artifactKinds: ['storyboard'] },
  ],
};

const run = (stageId: string): StageRun => ({
  id: `run:${stageId}`,
  projectId: 'project-1',
  stageId,
  status: 'completed',
  inputArtifacts: stageId === 'assets' ? [{ artifactId: 'script-1', version: '1' }] : [],
  outputArtifactIds: [`${stageId}-1`],
  generationTaskIds: [`task:${stageId}`],
  updatedAt: '2026-09-02T00:00:00.000Z',
});

describe('creative stage runtime', () => {
  it('propagates an upstream change without executing generation', () => {
    const state = { graph, runs: [run('script'), run('assets'), run('storyboard')] };
    const next = applyStageChange(state, 'assets', 'asset_input_changed', '2026-09-02T00:01:00.000Z');
    expect(next.runs.map((item) => item.status)).toEqual(['completed', 'stale', 'stale']);
    expect(state.runs[1].status).toBe('completed');
  });

  it('reconciles artifact version drift into stale state', () => {
    const assets = run('assets');
    const next = reconcileStageRun(assets, [{ artifactId: 'script-1', version: '2' }]);
    expect(next?.status).toBe('stale');
    expect(next?.staleReason).toBe('input_artifact_version_changed');
  });
});
