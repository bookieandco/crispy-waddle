import type { StoryboardStageBinding } from './storyboard-stage-binding.js';
import type { StoryboardSequence } from './storyboard-sequence.js';
import type { CreativeStage } from './creative-stage-graph.js';

export interface CreativeProvenance {
  projectId: string;
  storyboardBoardIds: string[];
  storyboardVersion: number;
  generationStageId: string;
  generationStageVersion: number;
  generationJobId: string;
}

export type DirectorCreativeProvenance = Omit<CreativeProvenance, 'generationJobId'>;

/**
 * Derives creative lineage from canonical persisted storyboard data and the
 * governed stage binding. The in-memory registry is deliberately not part of
 * this authority path.
 */
export function deriveDirectorCreativeProvenance(input: {
  sequence: StoryboardSequence;
  binding: StoryboardStageBinding;
  storyboardStage: CreativeStage;
  generationStage: CreativeStage;
  storyboardBoardId: string;
}): DirectorCreativeProvenance {
  if (!input.sequence.boardIds.includes(input.storyboardBoardId)) {
    throw new Error(`Storyboard board is not registered in its sequence: ${input.storyboardBoardId}`);
  }
  if (input.storyboardStage.id !== input.binding.stageIds.storyboard) {
    throw new Error('Storyboard stage does not match the storyboard stage binding.');
  }
  if (input.binding.stageIds.generation && input.generationStage.id !== input.binding.stageIds.generation) {
    throw new Error('Generation stage does not match the storyboard stage binding.');
  }
  if (input.sequence.projectId !== input.generationStage.projectId) {
    throw new Error('Storyboard lineage project does not match the generation project.');
  }
  if (input.binding.projectId !== input.sequence.projectId) {
    throw new Error('Storyboard stage binding project does not match the storyboard project.');
  }
  if (input.binding.storyboardBoardId !== input.storyboardBoardId) {
    throw new Error('Storyboard stage binding does not match the canonical storyboard board.');
  }

  return {
    projectId: input.sequence.projectId,
    storyboardBoardIds: [...input.sequence.boardIds],
    storyboardVersion: input.sequence.version,
    generationStageId: input.generationStage.id,
    generationStageVersion: input.generationStage.version,
  };
}

export function sameCreativeProvenance(a: CreativeProvenance, b: CreativeProvenance): boolean {
  return (
    a.projectId === b.projectId &&
    a.storyboardVersion === b.storyboardVersion &&
    a.generationStageId === b.generationStageId &&
    a.generationStageVersion === b.generationStageVersion &&
    a.generationJobId === b.generationJobId &&
    sameIds(a.storyboardBoardIds, b.storyboardBoardIds)
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.every((id, index) => id === right[index]);
}
