import {describe,expect,it} from 'vitest';
import {
  evaluateWorld3DBackend,
  HUNYUAN3D_1_PROFILE,
  REALSEE3D_PROFILE,
} from './world-3d-backend-profile';

describe('world 3d backend profiles',()=>{
  it('admits Hunyuan3D-1 for non-commercial prop generation when only its actual capabilities are required',()=>{
    const decision=evaluateWorld3DBackend(HUNYUAN3D_1_PROFILE,{
      id:'use:hunyuan-prop',
      use:'prop-asset-generation',
      requiredCapabilities:['image-to-mesh','mesh-texturing'],
      commercialProject:false,
      requireRuntime:true,
      evidenceIds:['asset-plan:prop'],
    });
    expect(decision.admissible).toBe(true);
  });

  it('blocks Hunyuan3D-1 from commercial production and from pretending to be a navigable world engine',()=>{
    const commercial=evaluateWorld3DBackend(HUNYUAN3D_1_PROFILE,{
      id:'use:hunyuan-commercial',
      use:'set-piece-generation',
      requiredCapabilities:['text-to-mesh'],
      commercialProject:true,
      requireRuntime:true,
      evidenceIds:['project:commercial'],
    });
    expect(commercial.reasons).toContain('DIRECTOR_3D_BACKEND_COMMERCIAL_USE_FORBIDDEN');

    const world=evaluateWorld3DBackend(HUNYUAN3D_1_PROFILE,{
      id:'use:hunyuan-world',
      use:'navigable-world',
      requiredCapabilities:['free-camera-world','navigable-world'],
      commercialProject:false,
      requireRuntime:true,
      evidenceIds:['world:need-free-camera'],
    });
    expect(world.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_3D_BACKEND_CAPABILITY_MISSING:free-camera-world',
      'DIRECTOR_3D_BACKEND_CAPABILITY_MISSING:navigable-world',
      'DIRECTOR_3D_BACKEND_NOT_NAVIGABLE_WORLD',
    ]));
  });

  it('treats Realsee3D as controlled-access benchmark data, not an inference runtime',()=>{
    const noAgreement=evaluateWorld3DBackend(REALSEE3D_PROFILE,{
      id:'use:realsee-benchmark',
      use:'research-benchmark',
      requiredCapabilities:['panoramic-rgbd','camera-extrinsics','metric-depth','covisibility'],
      commercialProject:false,
      requireRuntime:false,
      evidenceIds:['benchmark:world-reconstruction'],
    });
    expect(noAgreement.reasons).toContain('DIRECTOR_3D_BACKEND_ACCESS_AGREEMENT_REQUIRED');

    const approved=evaluateWorld3DBackend(REALSEE3D_PROFILE,{
      id:'use:realsee-benchmark',
      use:'research-benchmark',
      requiredCapabilities:['panoramic-rgbd','camera-extrinsics','metric-depth','covisibility'],
      commercialProject:false,
      datasetAgreementApproved:true,
      requireRuntime:false,
      evidenceIds:['benchmark:world-reconstruction','agreement:approved'],
    });
    expect(approved.admissible).toBe(true);

    const runtime=evaluateWorld3DBackend(REALSEE3D_PROFILE,{
      id:'use:realsee-runtime',
      use:'environment-reconstruction',
      requiredCapabilities:['point-cloud-reconstruction'],
      commercialProject:false,
      datasetAgreementApproved:true,
      requireRuntime:true,
      evidenceIds:['world:runtime'],
    });
    expect(runtime.reasons).toContain('DIRECTOR_3D_BACKEND_RUNTIME_REQUIRED');
  });
});
