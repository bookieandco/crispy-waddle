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
      formApproach: 'formalist',
      symbolicIntent: ['increase subjective pressure without changing performance blocking'],
    },
    composition: {
      shotSize: 'medium-close-up',
      angle: 'eye-level',
      framing: 'centered with restrained headroom',
      subjectPlacement: 'right third',
      balance: 'asymmetrical',
      gridStrategy: 'rule-of-thirds',
      subjectGridPlacement: 'upper-right intersection',
      leadRoom: 'short-sided',
      headroom: 'tight',
      shortSide: true,
      leadingLines: [
        {
          source: 'hallway walls',
          target: 'subject face',
          purpose: 'concentrate attention on the decision beat',
          evidenceRefs: ['frame:reference'],
        },
      ],
      focalPoints: [
        {
          target: 'subject face',
          priority: 1,
          placement: 'upper-right intersection',
          purpose: 'primary emotional information',
          evidenceRefs: ['frame:reference'],
        },
      ],
      frameWithinFrame: [
        {
          source: 'doorway',
          target: 'subject',
          shape: 'rectangle',
          purpose: 'visually contain the subject',
          evidenceRefs: ['frame:reference'],
        },
      ],
      depthLayers: [
        {layer:'foreground',content:'soft doorway edge',focusState:'soft',evidenceRefs:['frame:reference']},
        {layer:'midground',content:'subject',focusState:'sharp',evidenceRefs:['frame:reference']},
        {layer:'background',content:'hallway practicals',focusState:'soft',evidenceRefs:['frame:reference']},
      ],
      attentionCues: [
        {
          kind:'luminance-contrast',
          target:'subject face',
          description:'face remains the brightest local area against a darker hallway',
          evidenceRefs:['frame:reference'],
        },
      ],
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
    capture: {
      fps: 24,
      width: 1920,
      height: 1080,
      focusMode: 'locked',
      exposureMode: 'manual',
      exposureSeconds: 1 / 48,
      iso: 400,
      captureLook: 'smartphone',
      captureLookNotes: 'natural phone-camera motion and modest computational sharpness',
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
    expect(directive).toContain('rule-of-thirds composition');
    expect(directive).toContain('lead room short-sided');
    expect(directive).toContain('leading lines hallway walls -> subject face');
    expect(directive).toContain('focal points #1 subject face at upper-right intersection');
    expect(directive).toContain('frame-within-frame doorway frames subject as rectangle');
    expect(directive).toContain('depth layers foreground: soft doorway edge');
    expect(directive).toContain('attention cues luminance-contrast -> subject face');
    expect(directive).toContain('Capture:');
    expect(directive).toContain('capture look smartphone');
    expect(directive).toContain('natural phone-camera motion');
    expect(directive).toContain('Film-form approach: formalist');
    expect(directive).toContain('Symbolic intent: increase subjective pressure');
  });

  it('validates structured composition rather than leaving thirds and leading lines as free text', () => {
    const plan = basePlan({
      composition: {
        shotSize: 'medium',
        balance: 'symmetrical',
        gridStrategy: 'rule-of-thirds',
        leadingLines: [{ source: '', target: 'subject' }],
      },
    });
    const issues = validateDirectorCameraPlan(plan);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_COMPOSITION', path: 'composition.symmetryAxis', severity: 'warning' }),
      expect.objectContaining({ code: 'INVALID_COMPOSITION', path: 'composition.subjectGridPlacement', severity: 'warning' }),
      expect.objectContaining({ code: 'INVALID_COMPOSITION', path: 'composition.leadingLines[0]', severity: 'error' }),
    ]));
  });

  it('supports golden-triangle placement and requires intentional imbalance to carry a reason', () => {
    const golden = basePlan({
      composition: {
        shotSize:'wide',
        gridStrategy:'golden-triangle',
        subjectGridPlacement:'lower-right triangle intersection',
        balance:'balanced',
        focalPoints:[{target:'subject',priority:1}],
      },
    });
    expect(validateDirectorCameraPlan(golden)).toEqual([]);

    const unbalanced = basePlan({
      composition: {
        shotSize:'wide',
        balance:'intentionally-unbalanced',
      },
    });
    expect(validateDirectorCameraPlan(unbalanced)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code:'INVALID_COMPOSITION',
        path:'composition.intentionalRuleBreaks',
        severity:'error',
      }),
    ]));
  });

  it('fails closed when focal-point hierarchy or depth layers are ambiguous', () => {
    const plan = basePlan({
      composition: {
        shotSize:'wide',
        focalPoints:[
          {target:'subject-a',priority:1},
          {target:'subject-b',priority:1},
        ],
        depthLayers:[
          {layer:'foreground',content:'rail'},
          {layer:'foreground',content:'plant'},
        ],
      },
    });
    expect(validateDirectorCameraPlan(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({code:'INVALID_COMPOSITION',path:'composition.focalPoints',severity:'error'}),
      expect.objectContaining({code:'INVALID_COMPOSITION',path:'composition.depthLayers',severity:'error'}),
    ]));
  });

  it('requires a description for a custom capture look', () => {
    const plan=basePlan({
      capture:{captureLook:'custom'},
    });
    expect(validateDirectorCameraPlan(plan)).toEqual(expect.arrayContaining([
      expect.objectContaining({code:'INVALID_CAPTURE_LOOK',path:'capture.captureLookNotes',severity:'error'}),
    ]));
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

  it('compiles triggered rack-focus direction', () => {
    const plan = basePlan({
      focusEvents: [
        {
          trigger: 'the second subject enters the background doorway',
          fromTarget: 'foreground subject',
          toTarget: 'background subject',
          transitionSeconds: 0.35,
          holdSeconds: 0.8,
        },
      ],
    });
    const directive = compileDirectorCameraDirective(plan);
    expect(directive).toContain('Focus events:');
    expect(directive).toContain('from foreground subject');
    expect(directive).toContain('to background subject');
  });

  it('converts BPM to beat duration and frame timing', () => {
    expect(beatDurationSeconds(120)).toBe(0.5);
    expect(beatDurationSeconds(120, 2)).toBe(0.25);
    expect(framesPerBeat(24, 120)).toBe(12);
  });
});
