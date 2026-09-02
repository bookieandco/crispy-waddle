export type CreativeStageStatus =
  | 'empty'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stale';

export type CreativeStage = {
  id: string;
  name: string;
  upstreamStageIds: string[];
  artifactKinds: string[];
};

export type CreativeStageGraph = {
  version: string;
  stages: CreativeStage[];
};

export type StageArtifactVersion = {
  artifactId: string;
  version: string;
};

/** A stage-level execution record, separate from the single-request GenerationTask. */
export type StageRun = {
  id: string;
  projectId: string;
  stageId: string;
  status: CreativeStageStatus;
  inputArtifacts: StageArtifactVersion[];
  outputArtifactIds: string[];
  staleReason?: string;
  generationTaskIds: string[];
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type StageInvalidation = {
  stageId: string;
  reason: string;
  invalidatedAt: string;
};

export type RerunPlan = {
  targetStageId: string;
  stageIds: string[];
  invalidations: StageInvalidation[];
};

function stageMap(graph: CreativeStageGraph): Map<string, CreativeStage> {
  return new Map(graph.stages.map((stage) => [stage.id, stage]));
}

function assertGraph(graph: CreativeStageGraph): void {
  const ids = new Set<string>();
  for (const stage of graph.stages) {
    if (!stage.id.trim()) throw new Error('creative_stage_id_required');
    if (ids.has(stage.id)) throw new Error('creative_stage_duplicate_id');
    ids.add(stage.id);
  }
  for (const stage of graph.stages) {
    for (const upstreamId of stage.upstreamStageIds) {
      if (!ids.has(upstreamId)) throw new Error(`creative_stage_unknown_upstream:${upstreamId}`);
      if (upstreamId === stage.id) throw new Error('creative_stage_self_dependency');
    }
  }
}

/** Returns every stage that directly or transitively depends on stageId. */
export function downstreamStages(graph: CreativeStageGraph, stageId: string): string[] {
  assertGraph(graph);
  if (!stageMap(graph).has(stageId)) throw new Error(`creative_stage_unknown:${stageId}`);

  const downstream = new Set<string>();
  const queue = [stageId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const stage of graph.stages) {
      if (stage.upstreamStageIds.includes(current) && !downstream.has(stage.id)) {
        downstream.add(stage.id);
        queue.push(stage.id);
      }
    }
  }
  return [...downstream];
}

/** Marks the target and all downstream runs stale without mutating the inputs. */
export function invalidateDownstream(
  graph: CreativeStageGraph,
  runs: StageRun[],
  targetStageId: string,
  reason: string,
  invalidatedAt: string,
): StageRun[] {
  if (!reason.trim()) throw new Error('creative_stage_invalidation_reason_required');
  const affected = new Set([targetStageId, ...downstreamStages(graph, targetStageId)]);
  return runs.map((run) =>
    affected.has(run.stageId)
      ? { ...run, status: 'stale', staleReason: reason, updatedAt: invalidatedAt }
      : { ...run },
  );
}

/**
 * Builds a deterministic rerun order. This is planning only; it does not
 * authorize, execute, or submit GenerationTask work.
 */
export function buildRerunPlan(
  graph: CreativeStageGraph,
  targetStageId: string,
  now: string,
  reason = 'upstream_stage_changed',
): RerunPlan {
  assertGraph(graph);
  if (!graph.version.trim()) throw new Error('creative_stage_graph_version_required');
  const affected = new Set([targetStageId, ...downstreamStages(graph, targetStageId)]);
  const stageIds = graph.stages.filter((stage) => affected.has(stage.id)).map((stage) => stage.id);
  const targetIndex = stageIds.indexOf(targetStageId);
  if (targetIndex > 0) {
    stageIds.splice(targetIndex, 1);
    stageIds.unshift(targetStageId);
  }
  return {
    targetStageId,
    stageIds,
    invalidations: stageIds.map((stageId) => ({ stageId, reason, invalidatedAt: now })),
  };
}

/** Detects version drift in a completed/ready stage; explicit stale always wins. */
export function deriveStageStatus(
  run: StageRun | undefined,
  currentInputs: StageArtifactVersion[],
): CreativeStageStatus {
  if (!run) return 'empty';
  if (run.status === 'stale') return 'stale';
  if (run.status === 'running' || run.status === 'failed' || run.status === 'cancelled') return run.status;

  const expected = new Map(run.inputArtifacts.map((input) => [input.artifactId, input.version]));
  const changed = currentInputs.some((input) => expected.get(input.artifactId) !== input.version);
  return changed ? 'stale' : run.status;
}
