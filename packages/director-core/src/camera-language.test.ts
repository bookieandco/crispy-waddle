import { describe, expect, it } from 'vitest';
import {
  assertDirectorCameraPlan,
  beatDurationSeconds,
  compileDirectorCameraDirective,
  framesPerBeat,
  validateDirectorCameraPlan,
  type CameraProviderCapabilities,
  type DirectorCameraPlan,
} from './camera-language.js';

function basePlan(patch: Partial<DirectorCameraPlan> = {}): DirectorCameraPlan {
  return {
    version: 1,
    target: 'generative-video',
    intent: {
      narrativeFunction: 'increase pressure as the character reaches a decision',
      emotionalEffect: 'controlled tension',
      attentionTarget: 'the character eyes',
      energy: 'low',
      realism: 'grounded',
    },
    composition: {
      shotSize: 'medium-close-up',
      angle: 'eye-level',
      framing: 'centered with restrained headroom',
      subjectPlacement: 'center',
    },
    optics: {
      focalLengthMm: 50,
      focus: 'eyes',
      depthOfField: 'shallow but readable',
    },
    movements: [
      {
        kind: 'dolly-in',
        intensity: 'low',
        speed: 'slow',
        target: 'subject',
        motivation: 'the decision becomes more psychologically immediate',
      },
    ],
    timing: {
      durationSeconds: 4,
      oneTake: true,
    },
    preserve: ['shot-size', 'angle', 'lens'],
    ...patch,
  };
}

describe('Director camera language', () => {
  it('compiles concrete camera intent without relying on style adjectives', () => {
    const directive = compileDirectorCameraDirective(basePlan());
    expect(directive).toContain('Narrative function: increase pressure');
    expect(directive).toContain('Shot: medium-close-up, eye-level');
    expect(directive).toContain('Optics: 50mm');
    expect(directive).toContain('dolly-in');
    expect(directive).toContain('because the decision becomes more psychologically immediate');
    expect(directive).toContain('Timing: 4s, one take');
  });

  it('fails closed when a moving camera has no motivation', () => {
    const plan = basePlan({
      movements: [{ kind: 'orbit', intensity: 'medium' }],
    });
    expect(validateDirectorCameraPlan(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNMOTIVATED_MOVEMENT', severity: 'error' }),
    ]));
    expect(() => assertDirectorCameraPlan(plan)).toThrow('DIRECTOR_CAMERA_PLAN_INVALID');
  });

  it('rejects contradictory locked and moving camera instructions', () => {
    const plan = basePlan({
      movements: [
        { kind: 'locked' },
        { kind: 'pan', motivation: 'reveal the second subject entering frame' },
      ],
    });
    expect(validateDirectorCameraPlan(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'LOCKED_WITH_MOVEMENT', severity: 'error' }),
    ]));
  });

  it('validates keyframe timing against the shot duration', () => {
    const plan = basePlan({
      target: 'virtual-camera',
      keyframes: [
        { timeSeconds: 0, position: { x: 0, y: 1.6, z: 4 } },
        { timeSeconds: 4.5, position: { x: 0, y: 1.6, z: 2 } },
      ],
    });
    expect(validateDirectorCameraPlan(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'KEYFRAME_OUT_OF_RANGE', severity: 'error' }),
    ]));
  });

  it('checks physical camera plans against provider capabilities', () => {
    const capabilities: CameraProviderCapabilities = {
      providerId: 'mobile-capture',
      targets: ['physical-camera'],
      movementKinds: ['locked', 'handheld', 'pan', 'tilt'],
      capture: {
        fps: { min: 24, max: 60 },
        maxWidth: 3840,
        maxHeight: 2160,
        hdr: true,
        manualFocus: true,
        manualExposure: false,
        manualIso: false,
        torch: true,
        frameProcessing: true,
        zoom: { min: 1, max: 8 },
      },
    };
    const plan = basePlan({
      target: 'physical-camera',
      movements: [{ kind: 'handheld', intensity: 'minimal', motivation: 'retain operator-coupled realism' }],
      capture: {
        fps: 120,
        width: 3840,
        height: 2160,
        exposureMode: 'manual',
        iso: 400,
        frameProcessing: true,
      },
    });

    const issues = validateDirectorCameraPlan(plan, capabilities);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNSUPPORTED_CAPTURE_SETTING', path: 'capture.fps' }),
      expect.objectContaining({ code: 'UNSUPPORTED_CAPTURE_SETTING', path: 'capture.exposureMode' }),
      expect.objectContaining({ code: 'UNSUPPORTED_CAPTURE_SETTING', path: 'capture.iso' }),
    ]));
  });

  it('converts BPM to beat duration and frame timing', () => {
    expect(beatDurationSeconds(120)).toBe(0.5);
    expect(beatDurationSeconds(120, 2)).toBe(0.25);
    expect(framesPerBeat(24, 120)).toBe(12);
  });
});
