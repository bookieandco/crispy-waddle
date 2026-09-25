import { describe, expect, it, vi } from 'vitest';
import {
  performanceRigEvidence,
  validateCharacterPerformanceRigPlan,
  type CharacterPerformanceRigPlan,
} from './character-performance-rig';
import { createRigAnimationProvider } from './studio-rig-animation';
import { createDirectorStudioAction } from './studio-governed-action';

const plan: CharacterPerformanceRigPlan = {
  id: 'performance-rig:willie',
  projectId: 'project-1',
  characterAssetId: 'character:willie',
  eyePoses: {
    id: 'eyes:compass',
    control: 'eyes',
    defaultPoseId: 'default',
    poses: [
      { id: 'default', x: 0, y: 0 },
      { id: 'west', x: -1, y: 0 },
      { id: 'northwest', x: -.8, y: -.8 },
    ],
    blendInFrames: 2,
    blendOutFrames: 6,
    latchNonDefault: true,
  },
  eyebrowPoses: {
    id: 'brows:expressions',
    control: 'eyebrows',
    defaultPoseId: 'default',
    poses: [
      { id: 'default', y: 0, rotationDegrees: 0 },
      { id: 'raised', y: -.2, rotationDegrees: -8 },
      { id: 'quizzical', y: .1, rotationDegrees: 12 },
    ],
    blendInFrames: 2,
    blendOutFrames: 6,
    latchNonDefault: true,
  },
  jawFollow: {
    enabled: true,
    amount: .25,
    fixedAnchorId: 'face:under-nose',
    jawAnchorId: 'face:chin',
  },
  headBody: {
    enabled: true,
    bodyPositionStrength: .15,
    bodyTiltStrength: .1,
    headPositionStrength: .25,
    headTiltStrength: .75,
  },
  recording: {
    passOrder: ['eyes', 'eyebrows', 'hands'],
    defaultsOnlyForActivePass: true,
    hideCompletedPasses: true,
  },
  evidenceIds: ['character-direction:willie'],
  authority: 'DIRECTOR_CHARACTER_PERFORMANCE_RIG',
};

const track = {
  trackId: 'track:willie',
  class: 'character' as const,
  instanceId: 'willie',
  frameStart: 0,
  frameEnd: 24,
  annotations: [{ frame: 0, class: 'character' as const, instanceId: 'willie', confidence: .95 }],
  source: 'hybrid' as const,
  confidence: .95,
  approved: true,
};

describe('character performance rig', () => {
  it('accepts custom eye/brow pose sets, subtle jaw follow and decoupled head/body control', () => {
    expect(validateCharacterPerformanceRigPlan(plan).valid).toBe(true);
    expect(performanceRigEvidence(plan)).toEqual(expect.arrayContaining([
      'performance-rig:performance-rig:willie',
      'performance-rig-eyes:3',
      'performance-rig-eyebrows:3',
      'performance-rig-jaw:0.25',
      'performance-rig-head-body:decoupled',
    ]));
  });

  it('rejects missing pose defaults and overdriven jaw/head controls', () => {
    const invalid: CharacterPerformanceRigPlan = {
      ...plan,
      eyePoses: { ...plan.eyePoses!, defaultPoseId: 'missing' },
      jawFollow: { ...plan.jawFollow!, amount: 1.5 },
      headBody: { ...plan.headBody!, headTiltStrength: 1.2 },
    };
    expect(validateCharacterPerformanceRigPlan(invalid).reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_PERFORMANCE_RIG_DEFAULT_POSE_MISSING:eyes:compass',
      'DIRECTOR_PERFORMANCE_RIG_JAW_AMOUNT_INVALID',
      'DIRECTOR_PERFORMANCE_RIG_STRENGTH_INVALID:headTiltStrength',
    ]));
  });

  it('routes the plan through the existing governed rig provider and preserves evidence', async () => {
    const animate = vi.fn(async () => ({
      artifactId: 'motion-1',
      rigAssetId: 'rig-1',
      animationAssetId: 'animation-1',
      provider: 'rig-test',
      evidenceIds: ['solve:1'],
      frameStart: 0,
      frameEnd: 24,
    }));
    const provider = createRigAnimationProvider({ name: 'rig-test', animate });
    const request = createDirectorStudioAction({
      id: 'rig:1',
      userId: 'user-1',
      requestedAt: 'now',
      projectId: 'project-1',
      capability: 'rig',
      inputAssetIds: ['character:willie'],
      parameters: {
        trackingArtifactId: 'tracking:1',
        tracks: [track],
        channels: ['body', 'head', 'face'],
        performancePlan: plan,
      },
    });

    const result = await provider.execute(request.action, request);
    expect(animate).toHaveBeenCalledWith(expect.objectContaining({ performancePlan: plan }));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'performance-rig:performance-rig:willie',
      'character-direction:willie',
    ]));
  });
});
