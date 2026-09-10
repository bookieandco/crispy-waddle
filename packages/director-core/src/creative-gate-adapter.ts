import type { CreativeGate, ProductionRun } from '../../shotlist-core/src/production.js';
import type { CreativeStage, CreativeStageGraph } from './creative-stage-graph.js';
import type { CreativeProvenance } from './creative-provenance.js';

export type DirectorGenerationGateInput = {
  run: ProductionRun;
  gate: CreativeGate;
  storyboardStage?: CreativeStage;
  generationStage: CreativeStage;
  /** Explicit creative lineage required for every Director generation. */
  creativeProvenance: Omit<CreativeProvenance, 'generationJobId'>;
};

export type DirectorGenerationGateDecision = { allowed: boolean; reason: string };

/** Final Director-side gate before a generation take is submitted. */
export function evaluateDirectorGenerationGate(input: DirectorGenerationGateInput): DirectorGenerationGateDecision {
  if (input.run.status !== 'awaiting_approval' && input.run.status !== 'planning') return { allowed: false, reason: `Production run is not awaiting creative approval: ${input.run.status}` };
  if (input.gate.runId !== input.run.id || !input.run.gateIds.includes(input.gate.id)) return { allowed: false, reason: 'Generation gate is not bound to the production run.' };
  if (input.gate.kind !== 'generation' || input.gate.decision !== 'approved') return { allowed: false, reason: 'Generation requires an approved generation creative gate.' };
  if (input.generationStage.projectId !== input.run.projectId || input.generationStage.kind !== 'generation') return { allowed: false, reason: 'Generation stage is not bound to the production project.' };
  if (input.generationStage.status !== 'ready' && input.generationStage.status !== 'approved') return { allowed: false, reason: `Generation stage is not ready: ${input.generationStage.status}` };
  if (input.creativeProvenance.projectId !== input.run.projectId) return { allowed: false, reason: 'Creative provenance project does not match the production project.' };
  if (input.creativeProvenance.generationStageId !== input.generationStage.id || input.creativeProvenance.generationStageVersion !== input.generationStage.version) return { allowed: false, reason: 'Creative provenance does not match the generation stage version.' };
  if (input.storyboardStage) {
    if (input.storyboardStage.projectId !== input.run.projectId || input.storyboardStage.kind !== 'storyboard') return { allowed: false, reason: 'Storyboard stage is not bound to the production project.' };
    if (input.storyboardStage.status !== 'ready' && input.storyboardStage.status !== 'approved') return { allowed: false, reason: `Storyboard stage is not ready: ${input.storyboardStage.status}` };
  }
  return { allowed: true, reason: 'Generation creative gate, production binding, creative provenance, and stage readiness are satisfied.' };
}

export function invalidateGenerationStage(graph: CreativeStageGraph, stageId: string, reason: string, at: string): string[] {
  return graph.planRerun(stageId, { stageId, reason, at }).stageIds;
}
