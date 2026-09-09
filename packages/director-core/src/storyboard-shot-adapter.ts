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
  shotId: string,
): StoryboardShotPlan {
  const boards = sequence.boards
    .filter((board) => board.shotId === shotId)
    .sort((a, b) => a.order - b.order);

  if (boards.length === 0) throw new Error(`No storyboard boards found for shot: ${shotId}`);

  const latestVersion = Math.max(...boards.map((board) => board.version));
  const referenceAssetIds = unique(boards.flatMap((board) => board.referenceAssetIds));
  const continuityLocks = unique(
    boards.flatMap((board) => board.continuityLocks.length > 0 ? board.continuityLocks : DEFAULT_LOCKS),
  );

  return {
    projectId: sequence.projectId,
    sceneId: boards[0].sceneId,
    shotId,
    boardIds: boards.map((board) => board.id),
    boardVersion: latestVersion,
    prompt: boards.map(boardPrompt).filter(Boolean).join('\n'),
    referenceAssetIds,
    continuityLocks,
    cinematography: cinematographyFrom(boards),
  };
}

export function buildStoryboardTakePlan(
  sequence: StoryboardSequence,
  shotId: string,
  overrides: Pick<TakeRequest, 'takeCount' | 'parentTakeId' | 'targetRuntimeSeconds'> = {},
): StoryboardTakePlan {
  const shot = buildStoryboardShotPlan(sequence, shotId);
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

  return { shot, take: {
    sceneId: shot.sceneId,
    takeNumber: overrides.takeCount ?? 1,
    parentTakeId: overrides.parentTakeId,
    continuityLocks: takeRequest.locked,
    prompt: takeRequest.prompt,
    status: 'queued',
  } };
}

function boardPrompt(board: StoryboardBoard): string {
  return [board.action, board.composition, board.cameraIntent, board.notes]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' — ');
}

function cinematographyFrom(boards: StoryboardBoard[]): TakeRequest['cinematography'] {
  const board = boards[boards.length - 1];
  if (!board) return undefined;
  return board.cinematography;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
