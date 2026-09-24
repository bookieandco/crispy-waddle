import { describe, expect, it } from 'vitest';
import { validateAnimationPerformanceState } from './animation-performance-state.js';

describe('animation performance state with principles', () => {
  it('accepts a principles plan when its FPS matches the canonical timeline', () => {
    const decision = validateAnimationPerformanceState({
      id: 'anim:1',
      projectId: 'p',
      fps: 24,
      frameCount: 24,
      runs: [{
        id: 'run:1',
        frameStart: 0,
        frameEndExclusive: 24,
        characterAssetId: 'character:1',
        gesture: 'anticipation then turn',
        evidenceIds: ['track:1'],
      }],
      principlesPlan: {
        version: 1,
        narrativeGoal: 'make the reaction readable',
        primaryAction: 'turn toward the sound',
        method: 'pose-to-pose',
        poseHierarchy: { keys: ['neutral', 'anticipation', 'turn', 'settle'] },
        timing: { fps: 24, exposure: 'twos' },
      },
    });
    expect(decision.valid).toBe(true);
  });

  it('fails if principle timing disagrees with the canonical animation timeline', () => {
    const decision = validateAnimationPerformanceState({
      id: 'anim:2',
      projectId: 'p',
      fps: 24,
      frameCount: 24,
      runs: [{
        id: 'run:1',
        frameStart: 0,
        frameEndExclusive: 24,
        characterAssetId: 'character:1',
        evidenceIds: ['track:1'],
      }],
      principlesPlan: {
        version: 1,
        narrativeGoal: 'timed action',
        primaryAction: 'step',
        method: 'straight-ahead',
        timing: { fps: 30, exposure: 'ones' },
      },
    });
    expect(decision.valid).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_ANIMATION_PRINCIPLES_FPS_MISMATCH');
  });
});
