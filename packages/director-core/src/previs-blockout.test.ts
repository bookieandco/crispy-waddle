import { describe, expect, it } from 'vitest';
import {
  compilePrevisShotList,
  secondsToFrames,
  validatePrevisBlockout,
  type PrevisBlockoutPlan,
} from './previs-blockout.js';

function camera(narrativeFunction: string) {
  return {
    version: 1 as const,
    target: 'virtual-camera' as const,
    intent: { narrativeFunction },
    composition: { shotSize: 'close-up' as const, angle: 'eye-level' as const },
    optics: { focalLengthMm: 50 },
    movements: [{
      kind: 'dolly-in' as const,
      intensity: 'medium' as const,
      motivation: 'build impact before the hold',
    }],
    timing: { durationSeconds: 1 },
  };
}

function plan(): PrevisBlockoutPlan {
  return {
    id: 'previs:soda',
    projectId: 'ad:soda',
    fps: 24,
    frameCount: 96,
    width: 1920,
    height: 1080,
    objects: [
      { id: 'hero-can', primitive: 'cylinder', semanticRole: 'lime soda hero can', materialCue: 'lime green', referenceAssetIds: ['ref:lime-can'] },
      { id: 'ice', primitive: 'cube', semanticRole: 'ice cubes', referenceAssetIds: [] },
      { id: 'glass', primitive: 'cylinder', semanticRole: 'clear soda glass', materialCue: 'transparent', referenceAssetIds: ['ref:finished-glass'] },
      { id: 'lime', primitive: 'sphere', semanticRole: 'lime wedge placeholder', referenceAssetIds: ['ref:lime'] },
    ],
    referenceBindings: [
      { assetId: 'ref:lime-can', semanticRole: 'lime soda can identity', usage: 'identity' },
      { assetId: 'ref:finished-glass', semanticRole: 'finished drink appearance', usage: 'appearance' },
      { assetId: 'ref:lime', semanticRole: 'lime appearance', usage: 'appearance' },
      { assetId: 'ref:unused-box', semanticRole: '12-pack carton', usage: 'appearance' },
    ],
    shots: [
      {
        id: 'shot:1',
        order: 1,
        startFrame: 0,
        endFrameExclusive: 24,
        purpose: 'macro introduction on hero can',
        cameraPlan: camera('establish product identity'),
        visibleObjectIds: ['hero-can'],
        generationGaps: [],
        holdFrames: 4,
        cutStyle: 'hard',
      },
      {
        id: 'shot:2',
        order: 2,
        startFrame: 24,
        endFrameExclusive: 48,
        purpose: 'ice drop establishes refreshment',
        cameraPlan: camera('make the falling ice readable before impact'),
        visibleObjectIds: ['glass', 'ice'],
        generationGaps: [],
        cutStyle: 'hard',
      },
      {
        id: 'shot:3',
        order: 3,
        startFrame: 48,
        endFrameExclusive: 72,
        purpose: 'pour bridges product to finished drink',
        cameraPlan: camera('keep the glass as the visual anchor'),
        visibleObjectIds: ['hero-can', 'glass'],
        generationGaps: [{
          id: 'gap:pour',
          description: 'realistic carbonated soda pouring from the lime can into the glass',
          purpose: 'the blockout controls staging while the model supplies fluid detail',
          requiredReferenceAssetIds: ['ref:lime-can', 'ref:finished-glass'],
        }],
        cutStyle: 'hard',
      },
      {
        id: 'shot:4',
        order: 4,
        startFrame: 72,
        endFrameExclusive: 96,
        purpose: 'lime impact payoff',
        cameraPlan: camera('land the strongest impact beat'),
        visibleObjectIds: ['lime', 'glass'],
        generationGaps: [],
        holdFrames: 3,
      },
    ],
    authority: 'DIRECTOR_PREVIS_PLAN',
  };
}

describe('previs blockout', () => {
  it('preserves exact cut frames and explicit primitive semantics', () => {
    const result = compilePrevisShotList(plan());
    expect(result.cutFrames).toEqual([24, 48, 72]);
    expect(result.shotList).toContain('cylinder hero-can = lime soda hero can');
    expect(result.shotList).toContain('MODEL-FILL ONLY: realistic carbonated soda pouring');
  });

  it('omits unrelated references instead of confusing the generator', () => {
    const result = compilePrevisShotList(plan());
    expect(result.orderedReferenceAssetIds).toEqual([
      'ref:lime-can',
      'ref:finished-glass',
      'ref:lime',
    ]);
    expect(result.orderedReferenceAssetIds).not.toContain('ref:unused-box');
  });

  it('fails on timeline gaps rather than asking the model to invent timing', () => {
    const invalid = plan();
    invalid.shots = invalid.shots.map((shot) => shot.id === 'shot:2' ? { ...shot, startFrame: 26 } : shot);
    const issues = validatePrevisBlockout(invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PREVIS_TIMELINE_GAP' }),
    ]));
  });

  it('requires every primitive to have a semantic role', () => {
    const invalid = plan();
    invalid.objects = [{ ...invalid.objects[0]!, semanticRole: '' }, ...invalid.objects.slice(1)];
    const issues = validatePrevisBlockout(invalid);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PREVIS_OBJECT_SEMANTIC_ROLE_REQUIRED' }),
    ]));
  });

  it('converts time to exact frame boundaries and rejects fractional frames', () => {
    expect(secondsToFrames(1.5, 24)).toBe(36);
    expect(() => secondsToFrames(1 / 25, 24)).toThrow('DIRECTOR_PREVIS_NON_INTEGER_FRAME_BOUNDARY');
  });
});
