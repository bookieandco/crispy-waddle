import type { ContinuityLock, TakePlan, TakeRequest } from './generation-orchestrator.js';
import type { StoryboardBoard, StoryboardSequence } from './storyboard-sequence.js';

export interface StoryboardShotPlan {
  projectId: string;
  sceneId: string;
  shotId: string;
  boardIds: string[];
  boardVersion: number;
  prompt: string;
  referenceAssetIds: string[];
  continuityLocks: ContinuityLock[];
  cinematography?: TakeRequest['cinematography'];
}

export interface StoryboardTakePlan {
  shot: StoryboardShotPlan;
  take: TakePlan;
}

const DEFAULT_LOCKS: ContinuityLock[] = ['character', 'location', 'camera', 'composition', 'color'];

export function buildStoryboardShotPlan(
  sequence: StoryboardSequence,
  boards: StoryboardBoard[],
  shotId: string,
): StoryboardShotPlan {
  const sequenceBoardIds = new Set(sequence.boardIds);
  const shotBoards = boards
    .filter((board) => sequenceBoardIds.has(board.id) && board.shotId === shotId)
    .sort((a, b) => a.order - b.order);

  if (shotBoards.length === 0) throw new Error(`No storyboard boards found for shot: ${shotId}`);
  if (shotBoards.some((board) => board.sequenceId !== sequence.id || board.sceneId !== sequence.sceneId)) {
    throw new Error(`Storyboard board does not belong to sequence scene: ${sequence.id}`);
  }

  const latestVersion = Math.max(...shotBoards.map((board) => board.version));
  const referenceAssetIds = unique(shotBoards.flatMap((board) => board.referenceAssetIds));
  const continuityLocks = unique(
    shotBoards.flatMap((board) => board.continuityLocks?.length ? board.continuityLocks : DEFAULT_LOCKS),
  );

  return {
    projectId: sequence.projectId,
    sceneId: sequence.sceneId,
    shotId,
    boardIds: shotBoards.map((board) => board.id),
    boardVersion: latestVersion,
    prompt: shotBoards.map(boardPrompt).filter(Boolean).join('\n'),
    referenceAssetIds,
    continuityLocks,
    cinematography: cinematographyFrom(shotBoards),
  };
}

export function buildStoryboardTakePlan(
  sequence: StoryboardSequence,
  boards: StoryboardBoard[],
  shotId: string,
  overrides: Pick<TakeRequest, 'takeCount' | 'parentTakeId' | 'targetRuntimeSeconds'> = {},
): StoryboardTakePlan {
  const shot = buildStoryboardShotPlan(sequence, boards, shotId);
  const takeRequest: TakeRequest = {
    projectId: shot.projectId,
    sceneId: shot.sceneId,
    parentTakeId: overrides.parentTakeId,
    prompt: shot.prompt,
    targetRuntimeSeconds: overrides.targetRuntimeSeconds,
    takeCount: overrides.takeCount,
    locked: shot.continuityLocks,
    cinematography: shot.cinematography,
    referenceAssetIds: shot.referenceAssetIds,
  };

  return {
    shot,
    take: {
      sceneId: shot.sceneId,
      takeNumber: overrides.takeCount ?? 1,
      parentTakeId: overrides.parentTakeId,
      continuityLocks: takeRequest.locked,
      prompt: takeRequest.prompt,
      status: 'queued',
    },
  };
}

function boardPrompt(board: StoryboardBoard): string {
  return [board.action, board.description, board.framing, board.cameraLanguage, board.notes]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' — ');
}

function cinematographyFrom(boards: StoryboardBoard[]): TakeRequest['cinematography'] {
  const board = boards[boards.length - 1];
  return board?.cinematography;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
