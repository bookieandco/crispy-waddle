import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage, CreativeStageGraph } from './creative-stage-graph.js';
import type { DirectorCreativeProvenance } from './creative-provenance.js';
import { deriveDirectorCreativeProvenance } from './creative-provenance.js';
import type { DirectorStoryboardLineage } from './storyboard-lineage-resolver.js';

/** Caller-owned gate facts. Canonical lineage/provenance are deliberately excluded. */
export type DirectorGenerationGateInput = {
  run: ProductionRun;
  gate: CreativeGate;
  storyboardStage: CreativeStage;
  generationStage: CreativeStage;
};

/** Internal Director authority context assembled from persisted canonical state. */
export type AuthoritativeDirectorGenerationGateInput = DirectorGenerationGateInput & {
  storyboardLineage: DirectorStoryboardLineage;
};

export type DirectorGenerationGateDecision =
  | { allowed: false; reason: string }
  | { allowed: true; reason: string; creativeProvenance: DirectorCreativeProvenance };

/** Final Director-side gate before a generation take is submitted. */
export function evaluateDirectorGenerationGate(input: AuthoritativeDirectorGenerationGateInput): DirectorGenerationGateDecision {
  if (input.run.status !== 'awaiting_approval' && input.run.status !== 'planning') return { allowed: false, reason: `Production run is not awaiting creative approval: ${input.run.status}` };
  if (input.gate.runId !== input.run.id || !input.run.gateIds.includes(input.gate.id)) return { allowed: false, reason: 'Generation gate is not bound to the production run.' };
  if (input.gate.kind !== 'generation' || input.gate.decision !== 'approved') return { allowed: false, reason: 'Generation requires an approved generation creative gate.' };

  const { sequence, board, binding } = input.storyboardLineage;
  if (sequence.projectId !== input.run.projectId || board.projectId !== input.run.projectId || binding.projectId !== input.run.projectId) return { allowed: false, reason: 'Storyboard lineage is not bound to the production project.' };
  if (!input.run.shotIds.includes(board.shotId)) return { allowed: false, reason: 'Storyboard board is not bound to a shot in the production run.' };
  if (board.status !== 'ready' && board.status !== 'approved') return { allowed: false, reason: `Storyboard board is not ready: ${board.status}` };
  if (input.generationStage.projectId !== input.run.projectId || input.generationStage.kind !== 'generation') return { allowed: false, reason: 'Generation stage is not bound to the production project.' };
  if (input.generationStage.status !== 'ready' && input.generationStage.status !== 'approved') return { allowed: false, reason: `Generation stage is not ready: ${input.generationStage.status}` };
  if (!binding.stageIds.generation || input.generationStage.id !== binding.stageIds.generation) return { allowed: false, reason: 'Generation stage does not match the storyboard stage binding.' };
  if (input.storyboardStage.projectId !== input.run.projectId || input.storyboardStage.kind !== 'storyboard') return { allowed: false, reason: 'Storyboard stage is not bound to the production project.' };
  if (input.storyboardStage.id !== binding.stageIds.storyboard) return { allowed: false, reason: 'Storyboard stage does not match the storyboard stage binding.' };
  if (input.storyboardStage.status !== 'ready' && input.storyboardStage.status !== 'approved') return { allowed: false, reason: `Storyboard stage is not ready: ${input.storyboardStage.status}` };

  let creativeProvenance: DirectorCreativeProvenance;
  try {
    creativeProvenance = deriveDirectorCreativeProvenance({ sequence, binding, storyboardStage: input.storyboardStage, generationStage: input.generationStage, storyboardBoardId: board.id });
  } catch (error) {
    return { allowed: false, reason: error instanceof Error ? error.message : 'Unable to establish authoritative storyboard lineage.' };
  }

  return { allowed: true, reason: 'Generation gate, production binding, canonical storyboard lineage, and stage readiness are satisfied.', creativeProvenance };
}

export function invalidateGenerationStage(graph: CreativeStageGraph, stageId: string, reason: string, at: string): string[] {
  return graph.planRerun(stageId, { stageId, reason, at }).stageIds;
}
