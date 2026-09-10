import type { StoryboardStageBinding } from './storyboard-stage-binding.js';
import type { StoryboardSequenceRegistry } from './storyboard-sequence.js';
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
 * Derives creative lineage from the authoritative storyboard registry and
 * stage binding. Callers may propose provenance, but they cannot define the
 * lineage that the Director gate authorizes.
 */
export function deriveDirectorCreativeProvenance(input: {
  registry: StoryboardSequenceRegistry;
  binding: StoryboardStageBinding;
  storyboardStage: CreativeStage;
  generationStage: CreativeStage;
}): DirectorCreativeProvenance {
  const board = input.registry.getBoard(input.binding.storyboardBoardId);
  if (!board) throw new Error(`Unknown storyboard board: ${input.binding.storyboardBoardId}`);

  const sequence = input.registry.getSequence(board.sequenceId);
  if (!sequence) throw new Error(`Unknown storyboard sequence: ${board.sequenceId}`);
  if (sequence.projectId !== input.generationStage.projectId || board.projectId !== sequence.projectId) {
    throw new Error('Storyboard lineage project does not match the generation project.');
  }
  if (!sequence.boardIds.includes(board.id)) {
    throw new Error(`Storyboard board is not registered in its sequence: ${board.id}`);
  }
  if (input.storyboardStage.id !== input.binding.stageIds.storyboard) {
    throw new Error('Storyboard stage does not match the storyboard stage binding.');
  }
  if (input.binding.stageIds.generation && input.generationStage.id !== input.binding.stageIds.generation) {
    throw new Error('Generation stage does not match the storyboard stage binding.');
  }

  return {
    projectId: sequence.projectId,
    storyboardBoardIds: [...sequence.boardIds],
    storyboardVersion: sequence.version,
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
