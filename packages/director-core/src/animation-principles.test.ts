import { describe, expect, it } from 'vitest';
import {
  compileAnimationPrinciplesDirective,
  evaluateAnimationPrinciplesQc,
  validateAnimationPrinciplesPlan,
  type AnimationPrinciplesPlan,
} from './animation-principles.js';

function plan(): AnimationPrinciplesPlan {
  return {
    version: 1,
    narrativeGoal: 'make the landing feel heavy but readable',
    primaryAction: 'character jumps down and lands',
    method: 'hybrid',
    poseHierarchy: {
      keys: ['crouch', 'airborne apex', 'contact', 'settled pose'],
      extremes: ['deep anticipation crouch', 'compressed landing'],
      breakdowns: ['airborne arc', 'recovery'],
    },
    squashStretch: {
      amount: 'moderate',
      preserveVolume: true,
      peakMoment: 'one frame before impact through first contact',
      avoidContinuousStretch: true,
    },
    anticipation: {
      cues: ['crouch before takeoff', 'eyes settle on landing point'],
      audienceLead: 'landing point',
    },
    staging: {
      primaryRead: 'the jump and heavy landing',
      audienceAttentionTarget: 'character torso and feet',
      competingActionPolicy: 'subordinate',
      processingPauseSeconds: 0.15,
    },
    followThrough: [{
      driver: 'torso',
      followers: ['head', 'coat', 'hands'],
      lagFrames: 2,
      settleFrames: 5,
      massCue: 'coat is heavier than hair',
    }],
    easing: [{
      subject: 'body center',
      slowInFrames: 2,
      slowOutFrames: 4,
      noEaseAtImpact: true,
    }],
    arcs: [{
      subject: 'body center',
      path: 'parabolic downward arc into contact',
      referencePoints: ['takeoff', 'apex', 'contact'],
    }],
    secondaryActions: [{
      action: 'hands trail and recover after torso settles',
      purpose: 'reinforce weight and momentum',
      mustNotObscurePrimary: true,
    }],
    timing: {
      fps: 24,
      exposure: 'twos',
      primaryActionFrames: 24,
      readableHoldFrames: 4,
    },
    exaggeration: {
      ideaToClarify: 'the landing has real mass',
      strength: 'moderate',
      preserveBelievability: true,
    },
    solidForm: {
      preserveVolume: true,
      preserveWeight: true,
      preserveBalance: true,
      avoidTwinning: true,
      perspectiveCue: 'feet remain planted on the same ground plane',
    },
    appeal: {
      shapeLanguage: ['broad torso', 'compact limbs'],
      proportionEmphasis: ['large hands'],
      simplifyDetails: ['tiny fabric seams'],
      personalityRead: 'sturdy and determined',
    },
    evidenceRefs: ['lesson:12-principles'],
  };
}

describe('animation principles', () => {
  it('compiles the authored motion grammar into explicit direction', () => {
    const result = compileAnimationPrinciplesDirective(plan());
    expect(result).toContain('Squash/stretch: moderate; preserve volume');
    expect(result).toContain('Follow-through: torso leads');
    expect(result).toContain('do not ease into impact/contact');
    expect(result).toContain('avoid twinning/symmetry');
    expect(result).toContain('exposure twos');
  });

  it('rejects squash/stretch that changes overall volume', () => {
    const invalid = plan();
    invalid.squashStretch = { ...invalid.squashStretch!, preserveVolume: false };
    expect(validateAnimationPrinciplesPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ANIMATION_SQUASH_VOLUME_REQUIRED' }),
    ]));
  });

  it('requires keys for pose-to-pose or hybrid animation', () => {
    const invalid = plan();
    invalid.poseHierarchy = { keys: [] };
    expect(validateAnimationPrinciplesPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ANIMATION_POSE_HIERARCHY_REQUIRED' }),
    ]));
  });

  it('rejects malformed follow-through frame offsets', () => {
    const invalid = plan();
    invalid.followThrough = [{
      driver: 'torso',
      followers: ['hair'],
      lagFrames: -1,
      settleFrames: 4,
    }];
    expect(validateAnimationPrinciplesPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ANIMATION_FOLLOW_THROUGH_INVALID' }),
    ]));
  });

  it('keeps perception as evidence and Director as QC authority', () => {
    const decision = evaluateAnimationPrinciplesQc([
      {
        principle: 'staging',
        score: 0.92,
        confidence: 0.9,
        evidenceIds: ['vision:staging'],
      },
      {
        principle: 'arcs',
        score: 0.55,
        confidence: 0.86,
        evidenceIds: ['motion:arc'],
      },
    ], {
      requiredPrinciples: ['staging', 'arcs'],
      minimumScore: 0.7,
      minimumConfidence: 0.6,
    });

    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_ANIMATION_QC_SCORE_LOW:arcs');
    expect(decision.authority).toBe('DIRECTOR_ANIMATION_QC');
  });
});
