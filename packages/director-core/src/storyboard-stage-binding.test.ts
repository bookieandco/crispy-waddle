import { describe, expect, it } from 'vitest';
import { CreativeStageGraph } from './creative-stage-graph.js';
import { invalidateStoryboardStages, recordStoryboardArtifact } from './storyboard-stage-binding.js';

describe('storyboard stage binding', () => {
  const binding = {
    projectId: 'p1',
    storyboardBoardId: 'board-1',
    stageIds: { storyboard: 'storyboard', shotlist: 'shotlist', generation: 'generation', review: 'review' },
    version: 1,
  };

  it('propagates a storyboard revision through downstream stages', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'p1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'shotlist', projectId: 'p1', kind: 'shotlist', dependsOn: ['storyboard'], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'p1', kind: 'generation', dependsOn: ['shotlist'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'review', projectId: 'p1', kind: 'review', dependsOn: ['generation'], status: 'planned', inputArtifactIds: [], outputArtifactIds: [], version: 1 });

    const result = invalidateStoryboardStages(
      graph,
      binding,
      { boardId: 'board-1', reason: 'director changed camera blocking', at: '2026-09-09T00:00:00Z' },
      { boardId: 'board-1', affectedBoardIds: ['board-1'], affectedShotIds: ['shot-1'], reason: 'director changed camera blocking' },
    );

    expect(result.stagePlan.stageIds).toEqual(['storyboard', 'shotlist', 'generation', 'review']);
    expect(graph.get('generation')?.status).toBe('stale');
    expect(graph.get('review')?.status).toBe('stale');
  });

  it('rejects a binding for another storyboard board', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'p1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(() => invalidateStoryboardStages(
      graph,
      { ...binding, storyboardBoardId: 'board-a' },
      { boardId: 'board-b', reason: 'changed', at: '2026-09-09T00:00:00Z' },
      { boardId: 'board-b', affectedBoardIds: ['board-b'], affectedShotIds: [], reason: 'changed' },
    )).toThrow('Storyboard binding mismatch');
  });

  it('records storyboard provenance using the board version', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'p1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    const artifact = recordStoryboardArtifact(graph, 'storyboard', 7, 'artifact-7');
    expect(artifact).toEqual({ artifactId: 'artifact-7', stageId: 'storyboard', version: 7, createdAt: expect.any(String) });
  });
});
