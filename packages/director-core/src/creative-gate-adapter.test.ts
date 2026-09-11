import { describe, expect, it } from 'vitest';
import { CreativeStageGraph } from './creative-stage-graph.js';
import { evaluateDirectorGenerationGate, invalidateGenerationStage } from './creative-gate-adapter.js';
import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { DirectorStoryboardLineage } from './storyboard-lineage-resolver.js';
import type { StoryboardStageBinding } from './storyboard-stage-binding.js';

describe('creative gate adapter', () => {
  const run: ProductionRun = {
    id: 'run-1', projectId: 'project-1', status: 'awaiting_approval', createdAt: '2026-09-09T00:00:00Z', updatedAt: '2026-09-09T00:00:00Z', shotIds: ['shot-1'], gateIds: ['gate-1'],
  };
  const gate: CreativeGate = { id: 'gate-1', runId: 'run-1', kind: 'generation', decision: 'approved', requestedAt: '2026-09-09T00:00:00Z' };
  const binding: StoryboardStageBinding = {
    projectId: 'project-1', storyboardBoardId: 'board-1',
    stageIds: { storyboard: 'storyboard', shotlist: 'shotlist', generation: 'generation' }, version: 1,
  };
  const lineage: DirectorStoryboardLineage = {
    sequence: { id: 'sequence-1', projectId: 'project-1', sceneId: 'scene-1', boardIds: ['board-1', 'board-2'], version: 3, updatedAt: '2026-09-09T00:00:00Z' },
    board: { id: 'board-1', sequenceId: 'sequence-1', projectId: 'project-1', shotId: 'shot-1', order: 1, status: 'approved', referenceAssetIds: [], continuityAnchorIds: [], version: 2, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' },
    binding,
  };
  const provenance = { projectId: 'project-1', storyboardBoardIds: ['board-1', 'board-2'], storyboardVersion: 3, generationStageId: 'generation', generationStageVersion: 1 };

  function validInput(graph: CreativeStageGraph) {
    return { run, gate, storyboardStage: graph.get('storyboard')!, generationStage: graph.get('generation')!, creativeProvenance: provenance, storyboardLineage: lineage };
  }

  it('allows generation only with approved gate, ready stages, and authoritative provenance', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate(validInput(graph)).allowed).toBe(true);
  });

  it('rejects a missing authoritative storyboard lineage', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: [], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate({ run, gate, generationStage: graph.get('generation')!, creativeProvenance: provenance } as unknown as Parameters<typeof evaluateDirectorGenerationGate>[0]).allowed).toBe(false);
  });

  it('rejects caller-manufactured storyboard lineage', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate({ ...validInput(graph), creativeProvenance: { ...provenance, storyboardBoardIds: ['attacker-board'], storyboardVersion: 999 } }).allowed).toBe(false);
  });

  it('rejects pending gates and non-ready stages', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'planned', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate({ ...validInput(graph), gate: { ...gate, decision: 'pending' } }).allowed).toBe(false);
    expect(evaluateDirectorGenerationGate(validInput(graph)).allowed).toBe(false);
  });

  it('blocks generation when storyboard stage is stale', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'stale', inputArtifactIds: [], outputArtifactIds: [], version: 2 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(evaluateDirectorGenerationGate(validInput(graph)).allowed).toBe(false);
  });

  it('plans a deterministic downstream rerun when changes are requested', () => {
    const graph = new CreativeStageGraph();
    graph.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: 'approved', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    graph.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: 'ready', inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    expect(invalidateGenerationStage(graph, 'storyboard', 'director requested changes', '2026-09-09T01:00:00Z')).toEqual(['storyboard', 'generation']);
  });
});
