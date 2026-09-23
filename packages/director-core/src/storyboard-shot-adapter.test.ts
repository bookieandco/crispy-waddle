import { describe, expect, it } from 'vitest';
import { buildStoryboardShotPlan, buildStoryboardTakePlan } from './storyboard-shot-adapter.js';
import type { StoryboardBoard, StoryboardSequence } from './storyboard-sequence.js';

const sequence: StoryboardSequence = {
  id: 'seq-1', projectId: 'project-1', sceneId: 'scene-1', boardIds: ['b-1', 'b-2'],
  version: 2, updatedAt: '2026-09-09T00:00:00Z',
};

const boards: StoryboardBoard[] = [
  {
    id: 'b-1', sequenceId: 'seq-1', projectId: 'project-1', shotId: 'shot-1', order: 1,
    status: 'approved', action: 'Character enters', cameraLanguage: 'slow push-in',
    referenceAssetIds: ['ref-a'], continuityAnchorIds: ['char-a'],
    continuityLocks: ['character', 'camera'], version: 2, artifactIds: ['art-1'], updatedAt: '2026-09-09T00:00:00Z',
  },
  {
    id: 'b-2', sequenceId: 'seq-1', projectId: 'project-1', shotId: 'shot-1', order: 2,
    status: 'approved', action: 'Character looks toward camera', notes: 'Hold expression',
    referenceAssetIds: ['ref-b', 'ref-a'], continuityAnchorIds: ['char-a'],
    continuityLocks: ['character', 'composition'],
    cameraPlan: {
      version: 1,
      target: 'generative-video',
      intent: {
        narrativeFunction: 'compress distance as the character notices the camera',
        emotionalEffect: 'rising unease',
      },
      composition: {
        shotSize: 'medium-close-up',
        angle: 'eye-level',
      },
      optics: {
        focalLengthMm: 50,
      },
      movements: [
        {
          kind: 'dolly-in',
          intensity: 'low',
          speed: 'slow',
          motivation: 'the camera closes emotional distance at the realization beat',
        },
      ],
      timing: {
        durationSeconds: 6,
        oneTake: true,
      },
      preserve: ['shot-size', 'lens'],
    },
    version: 3, artifactIds: ['art-2'], updatedAt: '2026-09-09T00:00:00Z',
  },
];

describe('storyboard shot adapter', () => {
  it('merges ordered boards into one shot plan', () => {
    const plan = buildStoryboardShotPlan(sequence, boards, 'shot-1');
    expect(plan.boardIds).toEqual(['b-1', 'b-2']);
    expect(plan.boardVersion).toBe(3);
    expect(plan.referenceAssetIds).toEqual(['ref-a', 'ref-b']);
    expect(plan.continuityLocks).toEqual(['character', 'camera', 'composition']);
    expect(plan.prompt).toContain('Character enters');
    expect(plan.prompt).toContain('Character looks toward camera');
    expect(plan.cameraPlan?.intent.narrativeFunction).toContain('compress distance');
    expect(plan.cameraPlan?.optics?.focalLengthMm).toBe(50);
  });

  it('creates a queued take without executing generation', () => {
    const result = buildStoryboardTakePlan(sequence, boards, 'shot-1', { takeCount: 2, targetRuntimeSeconds: 6 });
    expect(result.take.status).toBe('queued');
    expect(result.take.takeNumber).toBe(2);
    expect(result.shot.shotId).toBe('shot-1');
    expect(result.shot.cameraPlan?.movements[0]?.kind).toBe('dolly-in');
  });

  it('fails closed when the latest storyboard camera plan is contradictory', () => {
    const invalidBoards = boards.map((board) => (
      board.id === 'b-2'
        ? {
            ...board,
            cameraPlan: {
              ...board.cameraPlan!,
              movements: [
                { kind: 'locked' as const },
                { kind: 'pan' as const, motivation: 'follow the entering character' },
              ],
            },
          }
        : board
    ));
    expect(() => buildStoryboardShotPlan(sequence, invalidBoards, 'shot-1')).toThrow('DIRECTOR_CAMERA_PLAN_INVALID');
  });

  it('rejects a shot with no boards', () => {
    expect(() => buildStoryboardShotPlan(sequence, boards, 'missing-shot')).toThrow('No storyboard boards found');
  });
});
