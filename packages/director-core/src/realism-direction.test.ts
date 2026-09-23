import { describe, expect, it } from 'vitest';
import {
  assertRealismDirectionPlan,
  compileRealismDirective,
  validateRealismDirectionPlan,
  type RealismDirectionPlan,
} from './realism-direction.js';

function plan(): RealismDirectionPlan {
  return {
    version: 1,
    goal: 'make the performance feel physically recorded rather than cosmetically perfect',
    naturalismCues: ['skin-texture', 'breathing', 'weight-shift', 'fabric-response', 'inertia', 'parallax'],
    physicalResponses: [
      {
        trigger: 'the driver brakes hard',
        subjectResponse: 'both occupants lunge forward with delayed recovery',
        wardrobeHairResponse: 'loose clothing and hair continue forward a fraction after the torso',
        cameraResponse: 'tripod remains spatially fixed',
        soundResponse: 'brake and body movement land in sync',
        endState: 'both bodies settle back into the seats',
      },
    ],
    sourcePreservation: {
      sourceAssetIds: ['iphone-performance-take'],
      preserve: ['identity', 'original-motion', 'camera', 'framing', 'timing'],
      changeOnly: ['character appearance', 'wardrobe texture'],
      timingMustMatch: true,
      spatialRelationshipsMustMatch: true,
      allowGlobalRegeneration: false,
    },
  };
}

describe('realism direction', () => {
  it('compiles cause-and-effect and source locks', () => {
    const text = compileRealismDirective(plan());
    expect(text).toContain('when the driver brakes hard');
    expect(text).toContain('wardrobe/hair loose clothing and hair continue forward');
    expect(text).toContain('LOCK/PRESERVE: identity, original-motion, camera, framing, timing');
    expect(text).toContain('CHANGE ONLY: character appearance; wardrobe texture');
  });

  it('rejects global regeneration when source elements are explicitly preserved', () => {
    const invalid = plan();
    invalid.sourcePreservation = { ...invalid.sourcePreservation!, allowGlobalRegeneration: true };
    expect(validateRealismDirectionPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GLOBAL_REGENERATION_CONFLICT' }),
    ]));
    expect(() => assertRealismDirectionPlan(invalid)).toThrow('DIRECTOR_REALISM_PLAN_INVALID');
  });

  it('requires an observable response to every physical trigger', () => {
    const invalid = plan();
    invalid.physicalResponses.push({ trigger: 'a light turns on' });
    expect(validateRealismDirectionPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PHYSICAL_RESPONSE_REQUIRED' }),
    ]));
  });
});
