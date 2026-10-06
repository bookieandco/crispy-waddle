import type {
  ComputeResourceProfileCatalog,
  ComputeWorkloadDraft,
} from './resource-profile.js';
import type { HomebaseRouterState } from './homebase-router.js';
import {
  buildRunpodWorkerDispatch,
  type RunpodWorkerDispatch,
} from './runpod-worker-adapter.js';

export type DirectorHumanMediaComputeEngine =
  | 'musetalk'
  | 'liveportrait'
  | 'sadtalker'
  | 'coqui-tts';

export type DirectorHumanMediaComputeTask =
  | 'lip-sync'
  | 'portrait-animation'
  | 'talking-head'
  | 'voice-synthesis'
  | 'voice-clone'
  | 'voice-conversion';

export type DirectorHumanMediaDeploymentTier='local-homebase'|'gpu-burst';

export type DirectorHumanMediaDeployment=Readonly<{
  id:string;
  engine:DirectorHumanMediaComputeEngine;
  tier:DirectorHumanMediaDeploymentTier;
  baseUrl:string;
  image:string;
  imageDigest:string;
  sourceRevision:string;
  modelArtifactDigests:readonly string[];
  productionReady:boolean;
  healthObservedAt:string;
  nodeId?:string;
  runpodEndpointId?:string;
}>;

export type DirectorHumanMediaComputeRequest=Readonly<{
  jobId:string;
  projectId:string;
  idempotencyKey:string;
  engine:DirectorHumanMediaComputeEngine;
  task:DirectorHumanMediaComputeTask;
  assetIds:readonly string[];
  sensitiveData:boolean;
  allowCloudBurst:boolean;
  estimatedDurationMinutes:number;
  maxCostUsdPerHour?:number;
  payload:Readonly<Record<string,unknown>>;
  createdAt:string;
}>;

export type DirectorHumanMediaComputeRoute=Readonly<{
  jobId:string;
  target:'HOMEBASE_LOCAL'|'RUNPOD_GPU'|'DEFER';
  reason:string;
  resourceProfileId:string;
  workloadDraft:ComputeWorkloadDraft;
  deploymentId?:string;
  endpoint?:string;
  expectedImageDigest?:string;
  runpodDispatch?:RunpodWorkerDispatch;
  canonicalCommitTarget:'HOMEBASE';
}>;

const SHA256_RE=/^(?:sha256:)?[a-f0-9]{64}$/i;

export const DIRECTOR_HUMAN_MEDIA_RESOURCE_PROFILES:ComputeResourceProfileCatalog=Object.freeze({
  'director.human-media.musetalk':Object.freeze({
    id:'director.human-media.musetalk',
    allowedKinds:Object.freeze(['video-generation'] as const),
    resources:Object.freeze({
      cpuCores:8,
      ramGiB:24,
      scratchGiB:64,
      gpu:Object.freeze({
        vendor:'nvidia' as const,
        count:1,
        minVramGiBPerDevice:8,
        requiredFeatures:['cuda'],
      }),
      networkMbps:100,
    }),
    labels:Object.freeze({subsystem:'director',engine:'musetalk',class:'human-media'}),
  }),
  'director.human-media.liveportrait':Object.freeze({
    id:'director.human-media.liveportrait',
    allowedKinds:Object.freeze(['video-generation'] as const),
    resources:Object.freeze({
      cpuCores:8,
      ramGiB:16,
      scratchGiB:48,
      gpu:Object.freeze({
        vendor:'nvidia' as const,
        count:1,
        minVramGiBPerDevice:8,
        requiredFeatures:['cuda'],
      }),
      networkMbps:100,
    }),
    labels:Object.freeze({subsystem:'director',engine:'liveportrait',class:'human-media'}),
  }),
  'director.human-media.sadtalker':Object.freeze({
    id:'director.human-media.sadtalker',
    allowedKinds:Object.freeze(['video-generation'] as const),
    resources:Object.freeze({
      cpuCores:4,
      ramGiB:16,
      scratchGiB:48,
      gpu:Object.freeze({
        vendor:'nvidia' as const,
        count:1,
        minVramGiBPerDevice:6,
        requiredFeatures:['cuda'],
      }),
      networkMbps:50,
    }),
    labels:Object.freeze({subsystem:'director',engine:'sadtalker',class:'human-media'}),
  }),
  'director.human-media.coqui-tts':Object.freeze({
    id:'director.human-media.coqui-tts',
    allowedKinds:Object.freeze(['voice-generation'] as const),
    resources:Object.freeze({
      cpuCores:4,
      ramGiB:16,
      scratchGiB:32,
      gpu:Object.freeze({
        vendor:'nvidia' as const,
        count:1,
        minVramGiBPerDevice:8,
        requiredFeatures:['cuda'],
      }),
      networkMbps:25,
    }),
    labels:Object.freeze({subsystem:'director',engine:'coqui-tts',class:'human-media'}),
  }),
});

const PROFILE_BY_ENGINE:Readonly<Record<DirectorHumanMediaComputeEngine,string>>=Object.freeze({
  musetalk:'director.human-media.musetalk',
  liveportrait:'director.human-media.liveportrait',
  sadtalker:'director.human-media.sadtalker',
  'coqui-tts':'director.human-media.coqui-tts',
});

const TASKS_BY_ENGINE:Readonly<Record<DirectorHumanMediaComputeEngine,readonly DirectorHumanMediaComputeTask[]>>=Object.freeze({
  musetalk:Object.freeze<DirectorHumanMediaComputeTask[]>(['lip-sync']),
  liveportrait:Object.freeze<DirectorHumanMediaComputeTask[]>(['portrait-animation']),
  sadtalker:Object.freeze<DirectorHumanMediaComputeTask[]>(['talking-head']),
  'coqui-tts':Object.freeze<DirectorHumanMediaComputeTask[]>(['voice-synthesis','voice-clone','voice-conversion']),
});

function validIso(value:string):boolean{
  return Number.isFinite(Date.parse(value));
}

function validDigest(value:string):boolean{
  return SHA256_RE.test(value.trim());
}

export function validateDirectorHumanMediaDeployment(
  deployment:DirectorHumanMediaDeployment,
):readonly string[]{
  const reasons:string[]=[];
  if(!deployment.id.trim()||!deployment.baseUrl.trim()||!deployment.image.trim()||!deployment.sourceRevision.trim()){
    reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_IDENTITY_REQUIRED');
  }
  if(!validDigest(deployment.imageDigest))reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_IMAGE_DIGEST_REQUIRED');
  if(!validIso(deployment.healthObservedAt))reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_HEALTH_TIME_INVALID');
  if(!deployment.modelArtifactDigests.length||deployment.modelArtifactDigests.some(digest=>!validDigest(digest))){
    reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_MODEL_DIGEST_REQUIRED');
  }
  if(deployment.tier==='gpu-burst'&&!deployment.runpodEndpointId?.trim()){
    reasons.push('DIRECTOR_HUMAN_MEDIA_RUNPOD_ENDPOINT_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function validateDirectorHumanMediaDeploymentParity(
  homebase:DirectorHumanMediaDeployment,
  burst:DirectorHumanMediaDeployment,
):readonly string[]{
  const reasons:string[]=[
    ...validateDirectorHumanMediaDeployment(homebase),
    ...validateDirectorHumanMediaDeployment(burst),
  ];
  if(homebase.tier!=='local-homebase')reasons.push('DIRECTOR_HUMAN_MEDIA_HOMEBASE_TIER_REQUIRED');
  if(burst.tier!=='gpu-burst')reasons.push('DIRECTOR_HUMAN_MEDIA_BURST_TIER_REQUIRED');
  if(homebase.engine!==burst.engine)reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_ENGINE_MISMATCH');
  if(homebase.image!==burst.image)reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_IMAGE_REF_MISMATCH');
  if(homebase.imageDigest!==burst.imageDigest)reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_IMAGE_DIGEST_MISMATCH');
  if(homebase.sourceRevision!==burst.sourceRevision)reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_SOURCE_MISMATCH');
  const left=[...homebase.modelArtifactDigests].sort();
  const right=[...burst.modelArtifactDigests].sort();
  if(left.length!==right.length||left.some((value,index)=>value!==right[index])){
    reasons.push('DIRECTOR_HUMAN_MEDIA_DEPLOYMENT_MODEL_BUNDLE_MISMATCH');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function directorHumanMediaComputeDraft(
  request:DirectorHumanMediaComputeRequest,
):ComputeWorkloadDraft{
  if(!request.jobId.trim()||!request.projectId.trim()||!request.idempotencyKey.trim()){
    throw new Error('DIRECTOR_HUMAN_MEDIA_COMPUTE_LINEAGE_REQUIRED');
  }
  if(!TASKS_BY_ENGINE[request.engine].includes(request.task)){
    throw new Error(`DIRECTOR_HUMAN_MEDIA_COMPUTE_ENGINE_TASK_MISMATCH:${request.engine}:${request.task}`);
  }
  if(!Number.isFinite(request.estimatedDurationMinutes)||request.estimatedDurationMinutes<=0){
    throw new Error('DIRECTOR_HUMAN_MEDIA_COMPUTE_DURATION_INVALID');
  }
  if(request.sensitiveData&&request.allowCloudBurst){
    throw new Error('DIRECTOR_HUMAN_MEDIA_COMPUTE_SENSITIVE_BURST_FORBIDDEN');
  }
  const profileId=PROFILE_BY_ENGINE[request.engine];
  return Object.freeze({
    id:`compute:${request.jobId}`,
    source:'director',
    kind:request.engine==='coqui-tts'?'voice-generation':'video-generation',
    authority:Object.freeze({
      system:'director-human-media',
      jobId:request.jobId,
      idempotencyKey:request.idempotencyKey,
      projectId:request.projectId,
    }),
    resourceProfileId:profileId,
    constraints:Object.freeze({
      sensitiveData:request.sensitiveData,
      allowCloudBurst:request.allowCloudBurst&&!request.sensitiveData,
      ...(request.maxCostUsdPerHour!==undefined?{maxCostUsdPerHour:request.maxCostUsdPerHour}:{}),
    }),
    dataLocalityKeys:Object.freeze([
      `human-media-engine:${request.engine}`,
      ...request.assetIds.map(assetId=>`asset:${assetId}`),
    ]),
    createdAt:request.createdAt,
  });
}

function deploymentsForEngine(
  engine:DirectorHumanMediaComputeEngine,
  deployments:readonly DirectorHumanMediaDeployment[],
):{homebase?:DirectorHumanMediaDeployment;burst?:DirectorHumanMediaDeployment}{
  return {
    homebase:deployments.find(deployment=>deployment.engine===engine&&deployment.tier==='local-homebase'),
    burst:deployments.find(deployment=>deployment.engine===engine&&deployment.tier==='gpu-burst'),
  };
}

export function routeDirectorHumanMediaCompute(
  request:DirectorHumanMediaComputeRequest,
  state:HomebaseRouterState,
  deployments:readonly DirectorHumanMediaDeployment[],
):DirectorHumanMediaComputeRoute{
  const workloadDraft=directorHumanMediaComputeDraft(request);
  const {homebase,burst}=deploymentsForEngine(request.engine,deployments);

  if(
    homebase?.productionReady===true &&
    state.homebaseReady &&
    state.localGpuReady
  ){
    const healthReasons=validateDirectorHumanMediaDeployment(homebase);
    if(healthReasons.length){
      return Object.freeze({
        jobId:request.jobId,
        target:'DEFER',
        reason:`HOMEBASE_HUMAN_MEDIA_DEPLOYMENT_INVALID:${healthReasons.join(',')}`,
        resourceProfileId:workloadDraft.resourceProfileId,
        workloadDraft,
        canonicalCommitTarget:'HOMEBASE',
      });
    }
    return Object.freeze({
      jobId:request.jobId,
      target:'HOMEBASE_LOCAL',
      reason:'DIRECTOR_HUMAN_MEDIA_LOCAL_FIRST',
      resourceProfileId:workloadDraft.resourceProfileId,
      workloadDraft,
      deploymentId:homebase.id,
      endpoint:homebase.baseUrl,
      expectedImageDigest:homebase.imageDigest,
      canonicalCommitTarget:'HOMEBASE',
    });
  }

  if(request.sensitiveData||!request.allowCloudBurst){
    return Object.freeze({
      jobId:request.jobId,
      target:'DEFER',
      reason:request.sensitiveData
        ?'DIRECTOR_HUMAN_MEDIA_SENSITIVE_LOCAL_REQUIRED'
        :'DIRECTOR_HUMAN_MEDIA_CLOUD_BURST_NOT_AUTHORIZED',
      resourceProfileId:workloadDraft.resourceProfileId,
      workloadDraft,
      canonicalCommitTarget:'HOMEBASE',
    });
  }

  if(state.offline||!state.runpodReachable||burst?.productionReady!==true){
    return Object.freeze({
      jobId:request.jobId,
      target:'DEFER',
      reason:'DIRECTOR_HUMAN_MEDIA_BURST_UNAVAILABLE',
      resourceProfileId:workloadDraft.resourceProfileId,
      workloadDraft,
      canonicalCommitTarget:'HOMEBASE',
    });
  }

  if(!homebase){
    return Object.freeze({
      jobId:request.jobId,
      target:'DEFER',
      reason:'DIRECTOR_HUMAN_MEDIA_HOMEBASE_BUNDLE_REQUIRED_FOR_PARITY',
      resourceProfileId:workloadDraft.resourceProfileId,
      workloadDraft,
      canonicalCommitTarget:'HOMEBASE',
    });
  }

  const parityReasons=validateDirectorHumanMediaDeploymentParity(homebase,burst);
  if(parityReasons.length){
    return Object.freeze({
      jobId:request.jobId,
      target:'DEFER',
      reason:`DIRECTOR_HUMAN_MEDIA_BURST_PARITY_FAILED:${parityReasons.join(',')}`,
      resourceProfileId:workloadDraft.resourceProfileId,
      workloadDraft,
      canonicalCommitTarget:'HOMEBASE',
    });
  }

  const runpodDispatch=buildRunpodWorkerDispatch(
    {
      id:request.jobId,
      subsystem:'director-human-media',
      jobClass:'gpu',
      sensitive:false,
      cloudBurstAllowed:true,
      requiresGpu:true,
      estimatedDurationMinutes:request.estimatedDurationMinutes,
    },
    'RUNPOD_GPU',
    {
      ...request.payload,
      engine:request.engine,
      task:request.task,
      projectId:request.projectId,
      expectedImageDigest:burst.imageDigest,
      sourceRevision:burst.sourceRevision,
      modelArtifactDigests:[...burst.modelArtifactDigests],
    },
    {endpointId:burst.runpodEndpointId},
  );

  return Object.freeze({
    jobId:request.jobId,
    target:'RUNPOD_GPU',
    reason:'DIRECTOR_HUMAN_MEDIA_LOCAL_UNAVAILABLE_GPU_BURST',
    resourceProfileId:workloadDraft.resourceProfileId,
    workloadDraft,
    deploymentId:burst.id,
    endpoint:burst.baseUrl,
    expectedImageDigest:burst.imageDigest,
    runpodDispatch,
    canonicalCommitTarget:'HOMEBASE',
  });
}
