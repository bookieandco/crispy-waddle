import { describe, expect, it } from 'vitest';
import { buildStoryboardShotPlan, buildStoryboardTakePlan } from './storyboard-shot-adapter.js';
import type { StoryboardSequence } from './storyboard-sequence.js';

const sequence: StoryboardSequence = {
  id: 'seq-1',
  projectId: 'project-1',
  sceneId: 'scene-1',
  boardIds: ['b-1', 'b-2'],
  version: 2,
  updatedAt: '2026-09-09T00:00:00Z',
  boards: [
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
      continuityLocks: ['character', 'composition'], version: 3, artifactIds: ['art-2'], updatedAt: '2026-09-09T00:00:00Z',
    },
  ],
};

describe('storyboard shot adapter', () => {
  it('merges ordered boards into one shot plan', () => {
    const plan = buildStoryboardShotPlan(sequence, 'shot-1');
    expect(plan.boardIds).toEqual(['b-1', 'b-2']);
    expect(plan.boardVersion).toBe(3);
    expect(plan.referenceAssetIds).toEqual(['ref-a', 'ref-b']);
    expect(plan.continuityLocks).toEqual(['character', 'camera', 'composition']);
    expect(plan.prompt).toContain('Character enters');
    expect(plan.prompt).toContain('Character looks toward camera');
  });

  it('creates a queued take without executing generation', () => {
    const result = buildStoryboardTakePlan(sequence, 'shot-1', { takeCount: 2, targetRuntimeSeconds: 6 });
    expect(result.take.status).toBe('queued');
    expect(result.take.takeNumber).toBe(2);
    expect(result.shot.shotId).toBe('shot-1');
  });

  it('rejects a shot with no boards', () => {
    expect(() => buildStoryboardShotPlan(sequence, 'missing-shot')).toThrow('No storyboard boards found');
  });
});
