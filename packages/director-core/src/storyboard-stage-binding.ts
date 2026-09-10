import type { CreativeStageGraph, RerunPlan, StageArtifactVersion } from './creative-stage-graph.js';
import type { StoryboardBoardChange, StoryboardInvalidationPlan } from './storyboard-sequence.js';

export interface StoryboardStageBinding {
  projectId: string;
  storyboardBoardId: string;
  stageIds: {
    storyboard: string;
    shotlist: string;
    previs?: string;
    generation?: string;
    edit?: string;
    review?: string;
  };
  version?: number;
}

export interface StoryboardStageInvalidation {
  storyboard: StoryboardInvalidationPlan;
  stagePlan: RerunPlan;
}

/** Connects storyboard revisions to the existing CreativeStageGraph. */
export function invalidateStoryboardStages(
  graph: CreativeStageGraph,
  binding: StoryboardStageBinding,
  change: StoryboardBoardChange,
  storyboard: StoryboardInvalidationPlan,
): StoryboardStageInvalidation {
  if (binding.storyboardBoardId !== change.boardId) {
    throw new Error(`Storyboard binding mismatch: ${change.boardId}`);
  }

  const storyboardStageId = binding.stageIds.storyboard;
  if (!graph.get(storyboardStageId)) {
    throw new Error(`Unknown storyboard creative stage: ${storyboardStageId}`);
  }

  const invalidation = {
    stageId: storyboardStageId,
    reason: change.reason,
    sourceStageId: storyboardStageId,
    at: change.at,
  };

  const stagePlan = graph.planRerun(storyboardStageId, invalidation);
  return { storyboard, stagePlan };
}

export function recordStoryboardArtifact(
  graph: CreativeStageGraph,
  stageId: string,
  boardVersion: number,
  artifactId: string,
): StageArtifactVersion {
  if (!graph.get(stageId)) throw new Error(`Unknown creative stage: ${stageId}`);
  return {
    artifactId,
    stageId,
    version: boardVersion,
    createdAt: new Date().toISOString(),
  };
}
