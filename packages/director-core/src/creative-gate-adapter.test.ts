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

  function graph(storyboardStatus: 'approved' | 'stale' = 'approved', generationStatus: 'ready' | 'planned' | 'stale' = 'ready') {
    const value = new CreativeStageGraph();
    value.add({ id: 'storyboard', projectId: 'project-1', kind: 'storyboard', dependsOn: [], status: storyboardStatus, inputArtifactIds: [], outputArtifactIds: [], version: storyboardStatus === 'stale' ? 2 : 1 });
    value.add({ id: 'generation', projectId: 'project-1', kind: 'generation', dependsOn: ['storyboard'], status: generationStatus, inputArtifactIds: [], outputArtifactIds: [], version: 1 });
    return value;
  }

  function validInput(value: CreativeStageGraph) {
    return { run, gate, storyboardStage: value.get('storyboard')!, generationStage: value.get('generation')!, storyboardLineage: lineage };
  }

  it('allows generation and derives provenance from canonical lineage', () => {
    const decision = evaluateDirectorGenerationGate(validInput(graph()));
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error(decision.reason);
    expect(decision.creativeProvenance).toEqual({
      projectId: 'project-1',
      storyboardBoardIds: ['board-1', 'board-2'],
      storyboardVersion: 3,
      generationStageId: 'generation',
      generationStageVersion: 1,
    });
  });

  it('rejects a missing authoritative storyboard lineage at runtime', () => {
    const value = graph();
    const unsafe = { run, gate, storyboardStage: value.get('storyboard')!, generationStage: value.get('generation')! } as unknown as Parameters<typeof evaluateDirectorGenerationGate>[0];
    expect(evaluateDirectorGenerationGate(unsafe).allowed).toBe(false);
  });

  it('rejects pending gates and non-ready generation stages', () => {
    const planned = graph('approved', 'planned');
    expect(evaluateDirectorGenerationGate({ ...validInput(planned), gate: { ...gate, decision: 'pending' } }).allowed).toBe(false);
    expect(evaluateDirectorGenerationGate(validInput(planned)).allowed).toBe(false);
  });

  it('blocks generation when storyboard stage is stale', () => {
    expect(evaluateDirectorGenerationGate(validInput(graph('stale'))).allowed).toBe(false);
  });

  it('rejects cross-project canonical lineage', () => {
    const forged: DirectorStoryboardLineage = {
      ...lineage,
      sequence: { ...lineage.sequence, projectId: 'other-project' },
    };
    expect(evaluateDirectorGenerationGate({ ...validInput(graph()), storyboardLineage: forged }).allowed).toBe(false);
  });

  it('rejects a canonical lineage whose binding points to another generation stage', () => {
    const mismatched: DirectorStoryboardLineage = {
      ...lineage,
      binding: { ...binding, stageIds: { ...binding.stageIds, generation: 'other-generation' } },
    };
    expect(evaluateDirectorGenerationGate({ ...validInput(graph()), storyboardLineage: mismatched }).allowed).toBe(false);
  });

  it('plans a deterministic downstream rerun when changes are requested', () => {
    const value = graph();
    expect(invalidateGenerationStage(value, 'storyboard', 'director requested changes', '2026-09-09T01:00:00Z')).toEqual(['storyboard', 'generation']);
  });
});
