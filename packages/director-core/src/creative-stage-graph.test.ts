import { describe, expect, it } from 'vitest';
import {
  buildRerunPlan,
  deriveStageStatus,
  downstreamStages,
  invalidateDownstream,
  type CreativeStageGraph,
  type StageRun,
} from './creative-stage-graph';

const graph: CreativeStageGraph = {
  version: '1.0',
  stages: [
    { id: 'script', name: 'Script', upstreamStageIds: [], artifactKinds: ['script'] },
    { id: 'assets', name: 'Assets', upstreamStageIds: ['script'], artifactKinds: ['character', 'scene'] },
    { id: 'storyboard', name: 'Storyboard', upstreamStageIds: ['assets'], artifactKinds: ['storyboard'] },
    { id: 'final', name: 'Final', upstreamStageIds: ['storyboard'], artifactKinds: ['video'] },
  ],
};

const run = (stageId: string, status: StageRun['status'] = 'completed'): StageRun => ({
  id: `run:${stageId}`,
  projectId: 'project-1',
  stageId,
  status,
  inputArtifacts: stageId === 'assets' ? [{ artifactId: 'script-1', version: '1' }] : [],
  outputArtifactIds: [`${stageId}-1`],
  generationTaskIds: [`task:${stageId}`],
  updatedAt: '2026-09-02T00:00:00.000Z',
});

describe('creative stage graph', () => {
  it('finds transitive downstream stages', () => {
    expect(downstreamStages(graph, 'script')).toEqual(['assets', 'storyboard', 'final']);
  });

  it('builds target-first rerun plan without executing work', () => {
    expect(buildRerunPlan(graph, 'assets', '2026-09-02T00:01:00.000Z').stageIds)
      .toEqual(['assets', 'storyboard', 'final']);
  });

  it('invalidates target and downstream while preserving unrelated runs', () => {
    const input = [run('script'), run('assets'), run('storyboard'), run('final')];
    const output = invalidateDownstream(graph, input, 'assets', 'script_changed', '2026-09-02T00:02:00.000Z');
    expect(output.map((item) => item.status)).toEqual(['completed', 'stale', 'stale', 'stale']);
    expect(output[1].staleReason).toBe('script_changed');
    expect(input[1].status).toBe('completed');
  });

  it('detects artifact version drift as stale', () => {
    const assets = run('assets');
    expect(deriveStageStatus(assets, [{ artifactId: 'script-1', version: '2' }])).toBe('stale');
    expect(deriveStageStatus(assets, [{ artifactId: 'script-1', version: '1' }])).toBe('completed');
  });

  it('fails closed on an unknown upstream stage', () => {
    expect(() => downstreamStages({ ...graph, stages: [
      { id: 'broken', name: 'Broken', upstreamStageIds: ['missing'], artifactKinds: [] },
    ] }, 'broken')).toThrow('creative_stage_unknown_upstream:missing');
  });
});
