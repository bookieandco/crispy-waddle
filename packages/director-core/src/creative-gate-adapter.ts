import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage, CreativeStageGraph } from './creative-stage-graph.js';

export type DirectorGenerationGateInput = {
  run: ProductionRun;
  gate: CreativeGate;
  storyboardStage?: CreativeStage;
  generationStage: CreativeStage;
};

export type DirectorGenerationGateDecision = {
  allowed: boolean;
  reason: string;
};

/** Final Director-side gate before a generation take is submitted. */
export function evaluateDirectorGenerationGate(
  input: DirectorGenerationGateInput,
): DirectorGenerationGateDecision {
  if (input.run.status !== 'awaiting_approval' && input.run.status !== 'planning') {
    return { allowed: false, reason: `Production run is not awaiting creative approval: ${input.run.status}` };
  }

  if (input.gate.kind !== 'generation' || input.gate.decision !== 'approved') {
    return { allowed: false, reason: 'Generation requires an approved generation creative gate.' };
  }

  if (input.storyboardStage && input.storyboardStage.status === 'stale') {
    return { allowed: false, reason: 'Generation is blocked because the storyboard stage is stale.' };
  }

  if (input.generationStage.status !== 'ready' && input.generationStage.status !== 'approved') {
    return { allowed: false, reason: `Generation stage is not ready: ${input.generationStage.status}` };
  }

  return { allowed: true, reason: 'Generation creative gate, storyboard lineage, and stage readiness are satisfied.' };
}

/** Marks a stage stale through the canonical graph after a gate requests changes. */
export function invalidateGenerationStage(
  graph: CreativeStageGraph,
  stageId: string,
  reason: string,
  at: string,
): string[] {
  return graph.planRerun(stageId, { stageId, reason, at }).stageIds;
}
