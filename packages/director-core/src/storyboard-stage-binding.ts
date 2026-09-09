import type {
  CreativeStageGraph,
  RerunPlan,
  StageArtifactVersion,
} from './creative-stage-graph.js';
import type { StoryboardBoardChange, StoryboardInvalidationPlan } from './storyboard-sequence.js';

export interface StoryboardStageBinding {
  storyboardBoardId: string;
  stageIds: {
    storyboard: string;
    shotlist: string;
    previs?: string;
    generation?: string;
    edit?: string;
    review?: string;
  };
}

export interface StoryboardStageInvalidation {
  storyboard: StoryboardInvalidationPlan;
  stagePlan: RerunPlan;
}

/**
 * Connects storyboard revisions to the existing CreativeStageGraph without
 * creating a second workflow or execution system.
 */
export function invalidateStoryboardStages(
  graph: CreativeStageGraph,
  binding: StoryboardStageBinding,
  change: StoryboardBoardChange,
): StoryboardStageInvalidation {
  const storyboardStageId = binding.stageIds.storyboard;
  const affectedStageIds = Object.values(binding.stageIds).filter(
    (stageId): stageId is string => Boolean(stageId),
  );

  for (const stageId of affectedStageIds) {
    if (!graph.get(stageId)) continue;
    graph.invalidate(stageId, {
      reason: change.reason,
      source: `storyboard:${change.boardId}`,
      at: change.at,
    });
  }

  const stagePlan = graph.planRerun(storyboardStageId);
  return {
    storyboard: {
      boardId: change.boardId,
      affectedBoardIds: [change.boardId],
      affectedShotIds: [],
      reason: change.reason,
    },
    stagePlan,
  };
}

export function recordStoryboardArtifact(
  graph: CreativeStageGraph,
  stageId: string,
  boardId: string,
  boardVersion: number,
  artifactId: string,
): StageArtifactVersion {
  const stage = graph.get(stageId);
  if (!stage) throw new Error(`Unknown creative stage: ${stageId}`);

  return {
    id: `${stageId}:${boardId}:v${boardVersion}`,
    stageId,
    version: boardVersion,
    artifactIds: [artifactId],
    sourceFingerprint: `storyboard:${boardId}:v${boardVersion}`,
    createdAt: new Date().toISOString(),
  };
}
