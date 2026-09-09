export type StoryboardBoardStatus = 'draft' | 'ready' | 'approved' | 'stale' | 'rejected';

export interface StoryboardBoard {
  id: string;
  sequenceId: string;
  projectId: string;
  shotId: string;
  order: number;
  status: StoryboardBoardStatus;
  title?: string;
  description?: string;
  scriptRef?: string;
  referenceAssetIds: string[];
  continuityAnchorIds: string[];
  cameraLanguage?: string;
  framing?: string;
  action?: string;
  notes?: string;
  version: number;
  artifactIds: string[];
  updatedAt: string;
}

export interface StoryboardSequence {
  id: string;
  projectId: string;
  sceneId: string;
  boardIds: string[];
  version: number;
  updatedAt: string;
}

export interface StoryboardBoardChange {
  boardId: string;
  reason: string;
  at: string;
}

export interface StoryboardInvalidationPlan {
  boardId: string;
  affectedBoardIds: string[];
  affectedShotIds: string[];
  reason: string;
}

/**
 * Pure storyboard sequencing model. Persistence, authorization and execution
 * remain outside Director-core.
 */
export class StoryboardSequenceRegistry {
  private readonly sequences = new Map<string, StoryboardSequence>();
  private readonly boards = new Map<string, StoryboardBoard>();

  addSequence(sequence: StoryboardSequence): void {
    if (this.sequences.has(sequence.id)) throw new Error(`Storyboard sequence already exists: ${sequence.id}`);
    this.sequences.set(sequence.id, structuredClone(sequence));
  }

  addBoard(board: StoryboardBoard): void {
    if (!this.sequences.has(board.sequenceId)) throw new Error(`Unknown storyboard sequence: ${board.sequenceId}`);
    if (this.boards.has(board.id)) throw new Error(`Storyboard board already exists: ${board.id}`);
    const sequence = this.sequences.get(board.sequenceId)!;
    if (sequence.boardIds.includes(board.id)) throw new Error(`Storyboard board already registered: ${board.id}`);
    sequence.boardIds.push(board.id);
    sequence.boardIds.sort((a, b) => (this.boards.get(a)?.order ?? Number.MAX_SAFE_INTEGER) - (this.boards.get(b)?.order ?? Number.MAX_SAFE_INTEGER));
    this.boards.set(board.id, structuredClone(board));
  }

  getBoard(boardId: string): StoryboardBoard | undefined {
    const board = this.boards.get(boardId);
    return board ? structuredClone(board) : undefined;
  }

  listBoards(sequenceId: string): StoryboardBoard[] {
    const sequence = this.sequences.get(sequenceId);
    if (!sequence) throw new Error(`Unknown storyboard sequence: ${sequenceId}`);
    return sequence.boardIds.map((id) => this.boards.get(id)).filter((board): board is StoryboardBoard => Boolean(board)).map((board) => structuredClone(board)).sort((a, b) => a.order - b.order);
  }

  updateBoard(boardId: string, patch: Partial<Omit<StoryboardBoard, 'id' | 'sequenceId' | 'projectId'>>): StoryboardBoard {
    const board = this.boards.get(boardId);
    if (!board) throw new Error(`Unknown storyboard board: ${boardId}`);
    Object.assign(board, structuredClone(patch), { version: board.version + 1 });
    return structuredClone(board);
  }

  /**
   * A board revision affects that board and later boards in the same sequence,
   * then returns the distinct shot ids requiring downstream reconsideration.
   */
  planInvalidation(change: StoryboardBoardChange): StoryboardInvalidationPlan {
    const board = this.boards.get(change.boardId);
    if (!board) throw new Error(`Unknown storyboard board: ${change.boardId}`);
    const affected = this.listBoards(board.sequenceId).filter((candidate) => candidate.order >= board.order);
    return {
      boardId: board.id,
      affectedBoardIds: affected.map((candidate) => candidate.id),
      affectedShotIds: [...new Set(affected.map((candidate) => candidate.shotId))],
      reason: change.reason,
    };
  }
}
