import type { CreativeStageGraph, StageArtifactVersion, StageRun } from './creative-stage-graph';
import { deriveStageStatus, invalidateDownstream } from './creative-stage-graph';

export type StageRuntimeState = {
  graph: CreativeStageGraph;
  runs: StageRun[];
};

/**
 * Reconciles stage state against the versions currently consumed by a stage.
 * This is state reconciliation only; execution remains owned by GenerationService.
 */
export function reconcileStageRun(
  run: StageRun | undefined,
  currentInputs: StageArtifactVersion[],
): StageRun | undefined {
  if (!run) return undefined;
  const status = deriveStageStatus(run, currentInputs);
  return status === run.status
    ? { ...run }
    : { ...run, status, staleReason: 'input_artifact_version_changed' };
}

/**
 * Applies an upstream change to the stage runtime and returns the immutable
 * state plus the affected stage IDs. No GenerationTask is created or executed.
 */
export function applyStageChange(
  state: StageRuntimeState,
  targetStageId: string,
  reason: string,
  now: string,
): StageRuntimeState {
  return {
    graph: state.graph,
    runs: invalidateDownstream(state.graph, state.runs, targetStageId, reason, now),
  };
}
