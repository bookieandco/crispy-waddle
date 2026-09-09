import { describe, expect, it } from 'vitest';
import { StoryboardSequenceRegistry } from './storyboard-sequence.js';

describe('StoryboardSequenceRegistry', () => {
  it('keeps boards ordered inside a sequence', () => {
    const registry = new StoryboardSequenceRegistry();
    registry.addSequence({ id: 'seq-1', projectId: 'p-1', sceneId: 'scene-1', boardIds: [], version: 1, updatedAt: '2026-09-09T00:00:00Z' });
    registry.addBoard({ id: 'b-2', sequenceId: 'seq-1', projectId: 'p-1', shotId: 'shot-2', order: 2, status: 'draft', referenceAssetIds: [], continuityAnchorIds: [], version: 1, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' });
    registry.addBoard({ id: 'b-1', sequenceId: 'seq-1', projectId: 'p-1', shotId: 'shot-1', order: 1, status: 'draft', referenceAssetIds: [], continuityAnchorIds: [], version: 1, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' });
    expect(registry.listBoards('seq-1').map((board) => board.id)).toEqual(['b-1', 'b-2']);
  });

  it('increments board version when a board is revised', () => {
    const registry = new StoryboardSequenceRegistry();
    registry.addSequence({ id: 'seq-1', projectId: 'p-1', sceneId: 'scene-1', boardIds: [], version: 1, updatedAt: '2026-09-09T00:00:00Z' });
    registry.addBoard({ id: 'b-1', sequenceId: 'seq-1', projectId: 'p-1', shotId: 'shot-1', order: 1, status: 'draft', referenceAssetIds: [], continuityAnchorIds: [], version: 1, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' });
    expect(registry.updateBoard('b-1', { action: 'turns toward camera' }).version).toBe(2);
  });

  it('propagates a board revision through later boards and distinct shots', () => {
    const registry = new StoryboardSequenceRegistry();
    registry.addSequence({ id: 'seq-1', projectId: 'p-1', sceneId: 'scene-1', boardIds: [], version: 1, updatedAt: '2026-09-09T00:00:00Z' });
    for (const board of [
      ['b-1', 'shot-1', 1],
      ['b-2', 'shot-2', 2],
      ['b-3', 'shot-2', 3],
      ['b-4', 'shot-3', 4],
    ] as const) {
      registry.addBoard({ id: board[0], sequenceId: 'seq-1', projectId: 'p-1', shotId: board[1], order: board[2], status: 'draft', referenceAssetIds: [], continuityAnchorIds: [], version: 1, artifactIds: [], updatedAt: '2026-09-09T00:00:00Z' });
    }
    expect(registry.planInvalidation({ boardId: 'b-2', reason: 'camera direction changed', at: '2026-09-09T01:00:00Z' })).toEqual({
      boardId: 'b-2',
      affectedBoardIds: ['b-2', 'b-3', 'b-4'],
      affectedShotIds: ['shot-2', 'shot-3'],
      reason: 'camera direction changed',
    });
  });
});
