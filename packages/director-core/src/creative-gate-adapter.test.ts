import { describe, expect, it } from 'vitest';
import { CreativeStageGraph } from './creative-stage-graph';
import { evaluateDirectorGenerationGate, invalidateGenerationStage } from './creative-gate-adapter';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production';

describe('creative gate adapter', () => {
  const run: ProductionRun = {
    id: 'run-1', projectId: 'project-1', status: 'awaiting_approval',
    createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:00:00Z', shotIds: ['shot-1'], gateIds: ['gate-1'],
  };
  const gate: CreativeGate = {
    id: 'gate-1', runId: 'run-1', kind: 'generation', decision: 'approved', requestedAt: '2026-09-09T00:00:00Z',
  };

  it('allows generation only when the generation gate is approved and the stage is ready', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: [], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate({ run, gate, generationStage: graph.get('generation')! }).allowed).toBe(true);
  });

  it('rejects pending gates and non-ready stages', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: [], status: 'planned', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate({ run, gate: { ...gate, decision: 'pending' }, generationStage: graph.get('generation')! }).allowed).toBe(false);
    expect(evaluateDirectorGenerationGate({ run, gate, generationStage: graph.get('generation')! }).allowed).toBe(false);
  });

  it('plans a deterministic downstream rerun when changes are requested', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(invalidateGenerationStage(graph, 'storyboard', 'director requested changes', '2026-09-09T01:00:00Z')).toEqual(['storyboard', 'generation']);
  });
});
