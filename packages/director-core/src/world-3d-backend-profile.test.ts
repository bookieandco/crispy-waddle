import {describe,expect,it} from 'vitest';
import {
  evaluateWorld3DBackend,
  HUNYUAN3D_1_PROFILE,
  LSRM_PROFILE,
  MATRIX_3D_PROFILE,
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

  it('admits LSRM for non-commercial sparse-view object reconstruction only after gated DINOv3 access is approved',()=>{
    const blocked=evaluateWorld3DBackend(LSRM_PROFILE,{
      id:'use:lsrm-object',
      use:'object-reconstruction',
      requiredCapabilities:['posed-sparse-multiview','foreground-mask-input','object-mesh-reconstruction','novel-view-synthesis'],
      commercialProject:false,
      requireRuntime:true,
      evidenceIds:['capture:posed-object-views'],
    });
    expect(blocked.reasons).toContain('DIRECTOR_3D_BACKEND_EXTERNAL_ACCESS_REQUIRED:meta:dinov3-vith16plus');

    const admitted=evaluateWorld3DBackend(LSRM_PROFILE,{
      id:'use:lsrm-object',
      use:'object-reconstruction',
      requiredCapabilities:['posed-sparse-multiview','foreground-mask-input','object-mesh-reconstruction','novel-view-synthesis','material-roughness','material-metallic'],
      commercialProject:false,
      approvedExternalAccessIds:['meta:dinov3-vith16plus'],
      requireRuntime:true,
      evidenceIds:['capture:posed-object-views','access:dinov3-approved'],
    });
    expect(admitted.admissible).toBe(true);
  });

  it('blocks LSRM for commercial or navigable-world use',()=>{
    const commercial=evaluateWorld3DBackend(LSRM_PROFILE,{
      id:'use:lsrm-commercial',
      use:'object-reconstruction',
      requiredCapabilities:['object-mesh-reconstruction'],
      commercialProject:true,
      approvedExternalAccessIds:['meta:dinov3-vith16plus'],
      requireRuntime:true,
      evidenceIds:['project:commercial'],
    });
    expect(commercial.reasons).toContain('DIRECTOR_3D_BACKEND_COMMERCIAL_USE_FORBIDDEN');

    const world=evaluateWorld3DBackend(LSRM_PROFILE,{
      id:'use:lsrm-world',
      use:'navigable-world',
      requiredCapabilities:['free-camera-world','navigable-world'],
      commercialProject:false,
      approvedExternalAccessIds:['meta:dinov3-vith16plus'],
      requireRuntime:true,
      evidenceIds:['world:full-scene'],
    });
    expect(world.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_3D_BACKEND_CAPABILITY_MISSING:free-camera-world',
      'DIRECTOR_3D_BACKEND_CAPABILITY_MISSING:navigable-world',
      'DIRECTOR_3D_BACKEND_NOT_NAVIGABLE_WORLD',
    ]));
  });

  it('admits Matrix-3D as a navigable world runtime for non-commercial/unknown-license evaluation',()=>{
    const decision=evaluateWorld3DBackend(MATRIX_3D_PROFILE,{
      id:'use:matrix-world',
      use:'navigable-world',
      requiredCapabilities:['text-to-panorama','panoramic-video-generation','panoramic-scene-reconstruction','custom-camera-trajectory','free-camera-world','navigable-world'],
      commercialProject:false,
      requireRuntime:true,
      evidenceIds:['world:generated-scene'],
    });
    expect(decision.admissible).toBe(true);
  });

  it('fails Matrix-3D closed for commercial production until checkpoint terms are verified',()=>{
    const decision=evaluateWorld3DBackend(MATRIX_3D_PROFILE,{
      id:'use:matrix-commercial',
      use:'navigable-world',
      requiredCapabilities:['free-camera-world','navigable-world'],
      commercialProject:true,
      requireRuntime:true,
      evidenceIds:['project:commercial'],
    });
    expect(decision.reasons).toContain('DIRECTOR_3D_BACKEND_COMMERCIAL_TERMS_UNKNOWN');
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
