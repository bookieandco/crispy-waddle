export type World3DBackendKind='asset-generator'|'reconstruction-runtime'|'dataset-benchmark';

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
  notes:readonly string[];
  sourceRefs:readonly string[];
  authority:'DIRECTOR_3D_BACKEND_PROFILE';
}

export interface World3DBackendRequirement {
  id:string;
  use:
    | 'prop-asset-generation'
    | 'set-piece-generation'
    | 'environment-reconstruction'
    | 'navigable-world'
    | 'research-benchmark';
  requiredCapabilities:readonly World3DCapability[];
  commercialProject:boolean;
  datasetAgreementApproved?:boolean;
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
