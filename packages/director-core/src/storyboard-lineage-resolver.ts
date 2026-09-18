import type { StoryboardStageBinding } from './storyboard-stage-binding.js';
import type { StoryboardBoard, StoryboardSequence } from './storyboard-sequence.js';
import type { StoryboardBindingRepository } from './storyboard-persistence.js';

export type DirectorStoryboardLineage = {
  sequence: StoryboardSequence;
  board: StoryboardBoard;
  binding: StoryboardStageBinding;
};

/**
 * Resolves Director storyboard lineage from persisted canonical state. No
 * caller-provided registry, board, sequence, or binding is accepted as authority.
 */
export class DirectorStoryboardLineageResolver {
  constructor(private readonly repository: StoryboardBindingRepository) {}

  async resolve(boardId: string, projectId: string): Promise<DirectorStoryboardLineage> {
    const board = await this.repository.getBoard(boardId, projectId);
    if (!board) throw new Error(`Storyboard board is not found for project: ${boardId}`);
    if (board.projectId !== projectId) throw new Error('Storyboard board project mismatch.');

    const sequence = await this.repository.getSequence(board.sequenceId, projectId);
    if (!sequence) throw new Error(`Storyboard sequence is not found for project: ${board.sequenceId}`);
    if (sequence.projectId !== projectId) throw new Error('Storyboard sequence project mismatch.');
    if (!sequence.boardIds.includes(board.id)) throw new Error('Storyboard board is not registered in its canonical sequence.');

    const binding = await this.repository.getBinding(board.id, projectId);
    if (!binding) throw new Error(`Storyboard stage binding is not found: ${board.id}`);
    if (binding.projectId !== projectId) throw new Error('Storyboard stage binding project mismatch.');
    if (binding.storyboardBoardId !== board.id) throw new Error('Storyboard stage binding does not match the board.');

    return { sequence, board, binding };
  }
}
