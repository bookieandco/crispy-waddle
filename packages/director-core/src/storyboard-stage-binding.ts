import type { CreativeStageGraph, RerunPlan, StageArtifactVersion } from './creative-stage-graph.js';
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
  storyboard: StoryboardInvalidationPlan,
): StoryboardStageInvalidation {
  const storyboardStageId = binding.stageIds.storyboard;
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
