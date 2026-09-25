export type World3DBackendKind='asset-generator'|'reconstruction-runtime'|'world-generator'|'dataset-benchmark';

export type World3DCapability =
  | 'text-to-mesh'
  | 'image-to-mesh'
  | 'fixed-multiview'
  | 'mesh-texturing'
  | 'turntable-render'
  | 'panoramic-rgbd'
  | 'metric-depth'
  | 'camera-extrinsics'
  | 'semantic-segmentation'
  | 'covisibility'
  | 'point-cloud-reconstruction'
  | 'posed-sparse-multiview'
  | 'foreground-mask-input'
  | 'object-mesh-reconstruction'
  | 'novel-view-synthesis'
  | 'inverse-rendering'
  | 'material-albedo'
  | 'material-roughness'
  | 'material-metallic'
  | 'text-to-panorama'
  | 'image-to-panorama'
  | 'panoramic-video-generation'
  | 'panoramic-scene-reconstruction'
  | 'custom-camera-trajectory'
  | 'gaussian-splat-scene'
  | 'free-camera-world'
  | 'navigable-world';

export type CommercialUsePolicy='allowed'|'forbidden'|'agreement-dependent'|'unknown';
export type BackendAccessMode='public'|'agreement-required';

export interface World3DBackendLicensePolicy {
  codeLicense:string;
  modelOrDataLicense:string;
  commercialUse:CommercialUsePolicy;
  restrictedFeatures?:readonly {
    feature:string;
    restriction:string;
    sourceRef:string;
  }[];
  evidenceIds:readonly string[];
}

export interface World3DBackendProfile {
  id:string;
  providerId:string;
  name:string;
  kind:World3DBackendKind;
  capabilities:readonly World3DCapability[];
  accessMode:BackendAccessMode;
  license:World3DBackendLicensePolicy;
  runtimeAvailable:boolean;
  requiredExternalAccessIds?:readonly string[];
  notes:readonly string[];
  sourceRefs:readonly string[];
  authority:'DIRECTOR_3D_BACKEND_PROFILE';
}

export interface World3DBackendRequirement {
  id:string;
  use:
    | 'prop-asset-generation'
    | 'set-piece-generation'
    | 'object-reconstruction'
    | 'environment-reconstruction'
    | 'navigable-world'
    | 'research-benchmark';
  requiredCapabilities:readonly World3DCapability[];
  commercialProject:boolean;
  datasetAgreementApproved?:boolean;
  approvedExternalAccessIds?:readonly string[];
  requireRuntime:boolean;
  evidenceIds:readonly string[];
}

export interface World3DBackendDecision {
  admissible:boolean;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_3D_BACKEND_QC';
}

export const HUNYUAN3D_1_PROFILE:World3DBackendProfile=Object.freeze({
  id:'tencent-hunyuan:hunyuan3d-1',
  providerId:'tencent-hunyuan',
  name:'Hunyuan3D-1',
  kind:'asset-generator',
  capabilities:Object.freeze([
    'text-to-mesh',
    'image-to-mesh',
    'fixed-multiview',
    'mesh-texturing',
    'turntable-render',
  ] as const),
  accessMode:'public',
  license:Object.freeze({
    codeLicense:'Tencent Hunyuan license headers plus third-party component licenses',
    modelOrDataLicense:'TENCENT HUNYUAN NON-COMMERCIAL LICENSE AGREEMENT',
    commercialUse:'forbidden',
    restrictedFeatures:Object.freeze([
      Object.freeze({
        feature:'mesh-baking',
        restriction:'The repository README states the Dust3R-backed baking module is CC BY-NC-SA 4.0 and cannot be used commercially.',
        sourceRef:'Tencent-Hunyuan/Hunyuan3D-1:README.md#Baking',
      }),
    ]),
    evidenceIds:Object.freeze([
      'github:Tencent-Hunyuan/Hunyuan3D-1:README',
      'github:Tencent-Hunyuan/Hunyuan3D-1:main.py-license-header',
    ]),
  }),
  runtimeAvailable:true,
  notes:Object.freeze([
    'Generates individual 3D assets from text or one image.',
    'Multi-view generation uses a fixed six-view azimuth set: 0, 60, 120, 180, 240 and 300 degrees relative to the input view.',
    'This is not a free-camera, navigable environment/world backend.',
  ]),
  sourceRefs:Object.freeze([
    'https://github.com/Tencent-Hunyuan/Hunyuan3D-1',
  ]),
  authority:'DIRECTOR_3D_BACKEND_PROFILE',
});

export const LSRM_PROFILE:World3DBackendProfile=Object.freeze({
  id:'facebookresearch:lsrm',
  providerId:'facebookresearch',
  name:'Large Sparse Reconstruction Model (LSRM)',
  kind:'reconstruction-runtime',
  capabilities:Object.freeze([
    'posed-sparse-multiview',
    'foreground-mask-input',
    'object-mesh-reconstruction',
    'novel-view-synthesis',
    'inverse-rendering',
    'mesh-texturing',
    'material-albedo',
    'material-roughness',
    'material-metallic',
    'turntable-render',
  ] as const),
  accessMode:'public',
  license:Object.freeze({
    codeLicense:'Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)',
    modelOrDataLicense:'CC BY-NC 4.0 for the released project; external dependencies retain their own terms',
    commercialUse:'forbidden',
    restrictedFeatures:Object.freeze([
      Object.freeze({
        feature:'runtime-backbone',
        restriction:'Inference requires separately gated DINOv3 ViT-H/16+ weights; access must be approved before runtime admission.',
        sourceRef:'facebookresearch/Large-Sparse-Reconstruction-Model:README.md#Setup',
      }),
    ]),
    evidenceIds:Object.freeze([
      'github:facebookresearch/Large-Sparse-Reconstruction-Model:README',
      'github:facebookresearch/Large-Sparse-Reconstruction-Model:LICENSE.md',
    ]),
  }),
  runtimeAvailable:true,
  requiredExternalAccessIds:Object.freeze(['meta:dinov3-vith16plus']),
  notes:Object.freeze([
    'Feed-forward object-centric reconstruction from posed sparse multi-view RGB images with foreground masks.',
    'Produces high-fidelity meshes/textures and novel-view renders; inverse-rendering mode predicts albedo, roughness and metallic materials.',
    'Inference is documented as requiring less than 40 GB GPU memory and was tested on NVIDIA H200.',
    'Blender is used headlessly for mesh/material rendering and relighting.',
    'This is an object-centric reconstruction runtime, not a full-scene or navigable-world backend.',
  ]),
  sourceRefs:Object.freeze([
    'https://github.com/facebookresearch/Large-Sparse-Reconstruction-Model',
  ]),
  authority:'DIRECTOR_3D_BACKEND_PROFILE',
});

export const MATRIX_3D_PROFILE:World3DBackendProfile=Object.freeze({
  id:'skyworkai:matrix-3d',
  providerId:'skyworkai',
  name:'Matrix-3D',
  kind:'world-generator',
  capabilities:Object.freeze([
    'text-to-panorama',
    'image-to-panorama',
    'panoramic-video-generation',
    'panoramic-scene-reconstruction',
    'custom-camera-trajectory',
    'gaussian-splat-scene',
    'free-camera-world',
    'navigable-world',
  ] as const),
  accessMode:'public',
  license:Object.freeze({
    codeLicense:'MIT',
    modelOrDataLicense:'Checkpoint/model terms are not specified in the GitHub README; verify released weight terms before commercial production.',
    commercialUse:'unknown',
    evidenceIds:Object.freeze([
      'github:SkyworkAI/Matrix-3D:README',
      'github:SkyworkAI/Matrix-3D:LICENSE',
    ]),
  }),
  runtimeAvailable:true,
  notes:Object.freeze([
    'Generates omnidirectional explorable 3D worlds from text or image via panorama image, panoramic video and 3D scene reconstruction stages.',
    'Supports custom camera trajectories; repository states camera matrices are world-to-camera matrices in OpenCV format.',
    'Optimization-based reconstruction emits a .ply Gaussian-splat scene; a feed-forward panoramic LRM path is also available.',
    'The README documents a 5B panoramic-video model with low-VRAM mode around 12 GB, while heavier stages can require substantially more VRAM.',
    'GitHub code is MIT, but Director keeps commercial use unresolved until checkpoint/model terms are independently verified.',
  ]),
  sourceRefs:Object.freeze([
    'https://github.com/SkyworkAI/Matrix-3D',
  ]),
  authority:'DIRECTOR_3D_BACKEND_PROFILE',
});

export const REALSEE3D_PROFILE:World3DBackendProfile=Object.freeze({
  id:'realsee:realsee3d',
  providerId:'realsee',
  name:'Realsee3D',
  kind:'dataset-benchmark',
  capabilities:Object.freeze([
    'panoramic-rgbd',
    'metric-depth',
    'camera-extrinsics',
    'semantic-segmentation',
    'covisibility',
    'point-cloud-reconstruction',
  ] as const),
  accessMode:'agreement-required',
  license:Object.freeze({
    codeLicense:'MIT for accompanying parsing/visualization/evaluation code',
    modelOrDataLicense:'Realsee3D Data Usage Agreement required for dataset access',
    commercialUse:'agreement-dependent',
    evidenceIds:Object.freeze([
      'github:realsee-developer/RealSee3D:README',
      'github:realsee-developer/RealSee3D:DATASET_STRUCTURE',
    ]),
  }),
  runtimeAvailable:false,
  notes:Object.freeze([
    'Dataset/benchmark, not a generation or reconstruction runtime by itself.',
    'Contains multi-view 360-degree RGB panoramas, aligned depth, camera-to-world extrinsics, floor indices and covisibility matrices.',
    'Real-world semantic maps are model predictions rather than human-verified ground truth.',
    'Synthetic scenes have dense depth and exact rendered semantic labels.',
  ]),
  sourceRefs:Object.freeze([
    'https://github.com/realsee-developer/RealSee3D',
  ]),
  authority:'DIRECTOR_3D_BACKEND_PROFILE',
});

export function evaluateWorld3DBackend(
  profile:World3DBackendProfile,
  requirement:World3DBackendRequirement,
):World3DBackendDecision{
  const reasons:string[]=[];
  if(!requirement.id.trim()||!requirement.evidenceIds.length){
    reasons.push('DIRECTOR_3D_BACKEND_REQUIREMENT_IDENTITY_REQUIRED');
  }
  if(!profile.id.trim()||!profile.providerId.trim()||!profile.sourceRefs.length||!profile.license.evidenceIds.length){
    reasons.push('DIRECTOR_3D_BACKEND_PROFILE_PROVENANCE_REQUIRED');
  }

  const supported=new Set(profile.capabilities);
  for(const capability of requirement.requiredCapabilities){
    if(!supported.has(capability)){
      reasons.push(`DIRECTOR_3D_BACKEND_CAPABILITY_MISSING:${capability}`);
    }
  }

  if(requirement.requireRuntime&&!profile.runtimeAvailable){
    reasons.push('DIRECTOR_3D_BACKEND_RUNTIME_REQUIRED');
  }

  if(profile.accessMode==='agreement-required'&&!requirement.datasetAgreementApproved){
    reasons.push('DIRECTOR_3D_BACKEND_ACCESS_AGREEMENT_REQUIRED');
  }

  const approvedExternalAccess=new Set(requirement.approvedExternalAccessIds??[]);
  for(const accessId of profile.requiredExternalAccessIds??[]){
    if(!approvedExternalAccess.has(accessId)){
      reasons.push(`DIRECTOR_3D_BACKEND_EXTERNAL_ACCESS_REQUIRED:${accessId}`);
    }
  }

  if(requirement.commercialProject){
    if(profile.license.commercialUse==='forbidden'){
      reasons.push('DIRECTOR_3D_BACKEND_COMMERCIAL_USE_FORBIDDEN');
    }else if(profile.license.commercialUse==='agreement-dependent'&&!requirement.datasetAgreementApproved){
      reasons.push('DIRECTOR_3D_BACKEND_COMMERCIAL_TERMS_UNRESOLVED');
    }else if(profile.license.commercialUse==='unknown'){
      reasons.push('DIRECTOR_3D_BACKEND_COMMERCIAL_TERMS_UNKNOWN');
    }
  }

  if(
    requirement.use==='navigable-world'&&
    (!supported.has('free-camera-world')||!supported.has('navigable-world'))
  ){
    reasons.push('DIRECTOR_3D_BACKEND_NOT_NAVIGABLE_WORLD');
  }

  if(
    requirement.use==='research-benchmark'&&
    profile.kind!=='dataset-benchmark'
  ){
    reasons.push('DIRECTOR_3D_BACKEND_NOT_BENCHMARK_DATASET');
  }

  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([
      ...requirement.evidenceIds,
      ...profile.license.evidenceIds,
      ...profile.sourceRefs.map(ref=>`source:${ref}`),
    ]),
    authority:'DIRECTOR_3D_BACKEND_QC',
  });
}
