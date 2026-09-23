import { describe, expect, it } from 'vitest';
import {
  buildPrevisGenerationReferenceManifest,
  compilePrevisShotList,
  evaluatePrevisExecutor,
  evaluatePrevisObservationCoverage,
  secondsToFrames,
  validatePrevisBlockout,
  validatePrevisExports,
  validatePrevisShotPackage,
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
      { assetId: 'ref:lime-can', semanticRole: 'lime soda can identity', usage: 'product-identity', evidenceIds: ['e:lime-can'] },
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
        cameraControl: 'rail',
        cameraRail: {
          points: [
            { x: 0, y: 1.4, z: 4 },
            { x: 0, y: 1.4, z: 2.5 },
          ],
          startFrame: 0,
          endFrameExclusive: 24,
          interpolation: 'ease-out',
        },
        objectTracks: {
          'hero-can': [
            { frame: 0, rotationDegrees: { x: 0, y: 0, z: 0 } },
            { frame: 20, rotationDegrees: { x: 0, y: 25, z: 0 }, interpolation: 'smooth' },
          ],
        },
        actorPoseTracks: [],
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

  it('keeps camera rails and authored object tracks in the compiled shot list', () => {
    const result = compilePrevisShotList(plan());
    expect(result.shotList).toContain('Camera control: rail');
    expect(result.shotList).toContain('Camera rail: frames 0-23, 2 points');
    expect(result.shotList).toContain('Object tracks: hero-can(2 keys)');
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

  it('validates that an exported shot package matches the authored shot exactly', () => {
    const reasons = validatePrevisShotPackage(plan(), 'shot:3', {
      shotId: 'shot:3',
      projectId: 'ad:soda',
      frameRange: { startFrame: 48, endFrameExclusive: 72 },
      fps: 24,
      resolution: { width: 1920, height: 1080 },
      firstFrameAssetId: 'asset:first',
      lastFrameAssetId: 'asset:last',
      greyboxClipAssetId: 'asset:greybox',
      cameraMetadataAssetId: 'asset:camera-json',
      promptAssetId: 'asset:prompt',
      conditioningPasses: {
        depth: 'asset:depth',
        normal: 'asset:normal',
      },
      referenceAssetIds: ['ref:lime-can', 'ref:finished-glass'],
      provenanceEvidenceIds: ['export:receipt'],
    });
    expect(reasons).toEqual([]);
  });

  it('turns a validated shot package into exact provider reference order', () => {
    const manifest = buildPrevisGenerationReferenceManifest(plan(), 'shot:3', {
      shotId: 'shot:3',
      projectId: 'ad:soda',
      frameRange: { startFrame: 48, endFrameExclusive: 72 },
      fps: 24,
      resolution: { width: 1920, height: 1080 },
      firstFrameAssetId: 'asset:first',
      lastFrameAssetId: 'asset:last',
      greyboxClipAssetId: 'asset:greybox',
      cameraMetadataAssetId: 'asset:camera-json',
      promptAssetId: 'asset:prompt',
      conditioningPasses: {
        depth: 'asset:depth',
        normal: 'asset:normal',
      },
      referenceAssetIds: ['ref:lime-can', 'ref:finished-glass'],
      provenanceEvidenceIds: ['export:receipt'],
    });

    expect(manifest.references.map((reference) => [reference.slot, reference.assetId, reference.media, reference.role])).toEqual([
      [1, 'asset:greybox', 'video', 'motion'],
      [2, 'asset:first', 'image', 'first-frame'],
      [3, 'asset:last', 'image', 'last-frame'],
      [4, 'ref:lime-can', 'image', 'product-identity'],
      [5, 'ref:finished-glass', 'image', 'custom'],
      [6, 'asset:depth', 'image', 'depth'],
      [7, 'asset:normal', 'image', 'normal'],
    ]);
  });

  it('rejects a shot package missing an authored reference', () => {
    const reasons = validatePrevisShotPackage(plan(), 'shot:3', {
      shotId: 'shot:3',
      projectId: 'ad:soda',
      frameRange: { startFrame: 48, endFrameExclusive: 72 },
      fps: 24,
      resolution: { width: 1920, height: 1080 },
      greyboxClipAssetId: 'asset:greybox',
      cameraMetadataAssetId: 'asset:camera-json',
      promptAssetId: 'asset:prompt',
      conditioningPasses: {},
      referenceAssetIds: ['ref:lime-can'],
      provenanceEvidenceIds: ['export:receipt'],
    });
    expect(reasons).toContain('DIRECTOR_PREVIS_PACKAGE_REFERENCE_MISSING:ref:finished-glass');
  });

  it('requires a previs executor to satisfy authored shot capabilities', () => {
    const decision = evaluatePrevisExecutor(plan(), {
      id: 'browser-previs',
      name: 'Browser Previs',
      runtime: 'browser',
      features: [
        'scene-primitives',
        'multi-shot',
        'focal-length-control',
        'reference-clip-export',
        'camera-keyframes',
        'camera-rails',
        'object-keyframes',
      ],
      supportedAspectRatios: ['16:9'],
      provenanceRefs: ['reference:capability-audit'],
    });
    expect(decision.admissible).toBe(true);
  });

  it('rejects a previs executor that cannot reproduce an authored camera rail', () => {
    const decision = evaluatePrevisExecutor(plan(), {
      id: 'keyframes-only',
      name: 'Keyframes Only',
      runtime: 'browser',
      features: ['scene-primitives', 'multi-shot', 'focal-length-control', 'reference-clip-export', 'camera-keyframes', 'object-keyframes'],
      supportedAspectRatios: ['16:9'],
      provenanceRefs: ['reference:capability-audit'],
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_PREVIS_EXECUTOR_FEATURE_MISSING:camera-rails');
  });

  it('fails if a vision pass samples around authored shots instead of covering them', () => {
    const observations = plan().shots.slice(0, 3).map((shot) => ({
      shotId: shot.id,
      observedStartFrame: shot.startFrame,
      observedEndFrameExclusive: shot.endFrameExclusive,
      observedSemanticRoles: shot.visibleObjectIds.map((id) =>
        plan().objects.find((object) => object.id === id)!.semanticRole,
      ),
      confidence: 0.9,
      evidenceIds: [`evidence:${shot.id}`],
    }));
    const decision = evaluatePrevisObservationCoverage(plan(), observations);
    expect(decision.valid).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_PREVIS_OBSERVATION_MISSING:shot:4');
  });

  it('requires export provenance from the exact previs plan', () => {
    const reasons = validatePrevisExports(plan(), [{
      kind: 'reference-clip',
      assetId: 'asset:previs-mp4',
      sha256: 'sha:previs',
      sourcePlanId: 'wrong-plan',
      evidenceIds: ['evidence:render'],
    }], ['reference-clip', 'camera-json']);
    expect(reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_PREVIS_EXPORT_PLAN_MISMATCH:reference-clip',
      'DIRECTOR_PREVIS_EXPORT_REQUIRED:camera-json',
    ]));
  });

  it('converts time to exact frame boundaries and rejects fractional frames', () => {
    expect(secondsToFrames(1.5, 24)).toBe(36);
    expect(() => secondsToFrames(1 / 25, 24)).toThrow('DIRECTOR_PREVIS_NON_INTEGER_FRAME_BOUNDARY');
  });
});
