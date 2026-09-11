import { describe, expect, it } from 'vitest';
import { CreativeStageGraph } from './creative-stage-graph';

describe('CreativeStageGraph', () => {
  it('propagates a changed upstream stage into a deterministic rerun plan', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'vision', projectId: 'p', kind: 'vision', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: ['v1'], version: 1 });
    graph.add({ id: 'treatment', projectId: 'p', kind: 'treatment', dependsOn: ['vision'], status: 'approved', inputArtifactIds: ['v1'], outputArtifactIds: ['t1'], version: 1 });
    graph.add({ id: 'generation', projectId: 'p', kind: 'generation', dependsOn: ['treatment'], status: 'approved', inputArtifactIds: ['t1'], outputArtifactIds: ['g1'], version: 1 });

    const plan = graph.planRerun('vision', {
      stageId: 'vision', reason: 'director vision changed', sourceArtifactId: 'v2', at: '2026-09-09T00:00:00Z',
    });

    expect(plan.stageIds).toEqual(['vision', 'treatment', 'generation']);
    expect(graph.get('vision')?.status).toBe('stale');
    expect(graph.get('treatment')?.status).toBe('stale');
    expect(graph.get('generation')?.status).toBe('stale');
  });
});
