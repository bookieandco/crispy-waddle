export type HomebaseJobClass='interactive'|'local-service'|'research'|'batch'|'gpu';
export type HomebaseExecutionTarget='HOMEBASE_LOCAL'|'RUNPOD_CPU'|'RUNPOD_GPU'|'DEFER';

export type HomebaseJobEnvelope={
  id:string;
  subsystem:string;
  jobClass:HomebaseJobClass;
  sensitive:boolean;
  cloudBurstAllowed:boolean;
  requiresGpu:boolean;
  estimatedDurationMinutes:number;
  maxCostUsd?:number;
};

export type HomebaseRouterState={
  homebaseReady:boolean;
  localGpuReady:boolean;
  runpodReachable:boolean;
  offline:boolean;
};

export type HomebaseRouteDecision={
  jobId:string;
  target:HomebaseExecutionTarget;
  reason:string;
  canonicalCommitTarget:'HOMEBASE';
};

export function routeHomebaseJob(job:HomebaseJobEnvelope,state:HomebaseRouterState):HomebaseRouteDecision{
  if(!job.id.trim())throw new Error('HOMEBASE_JOB_ID_REQUIRED');
  if(job.sensitive||!job.cloudBurstAllowed){
    return {
      jobId:job.id,
      target:state.homebaseReady?'HOMEBASE_LOCAL':'DEFER',
      reason:job.sensitive?'SENSITIVE_DATA_STAYS_HOMEBASE':'CLOUD_BURST_NOT_AUTHORIZED',
      canonicalCommitTarget:'HOMEBASE',
    };
  }
  if(state.offline||!state.runpodReachable){
    if(state.homebaseReady&&(!job.requiresGpu||state.localGpuReady)){
      return {jobId:job.id,target:'HOMEBASE_LOCAL',reason:'REMOTE_UNAVAILABLE_LOCAL_FALLBACK',canonicalCommitTarget:'HOMEBASE'};
    }
    return {jobId:job.id,target:'DEFER',reason:'REMOTE_UNAVAILABLE_LOCAL_CAPACITY_MISSING',canonicalCommitTarget:'HOMEBASE'};
  }
  if(job.jobClass==='research'||job.jobClass==='batch'){
    return {jobId:job.id,target:job.requiresGpu?'RUNPOD_GPU':'RUNPOD_CPU',reason:'RUNPOD_RESEARCH_BURST_PREFERRED',canonicalCommitTarget:'HOMEBASE'};
  }
  if(job.jobClass==='gpu'&&(!state.localGpuReady||job.estimatedDurationMinutes>=15)){
    return {jobId:job.id,target:'RUNPOD_GPU',reason:'RUNPOD_GPU_BURST_PREFERRED',canonicalCommitTarget:'HOMEBASE'};
  }
  if(state.homebaseReady){
    return {jobId:job.id,target:'HOMEBASE_LOCAL',reason:'HOMEBASE_LOCAL_PREFERRED',canonicalCommitTarget:'HOMEBASE'};
  }
  return {jobId:job.id,target:'DEFER',reason:'NO_ADMISSIBLE_EXECUTION_TARGET',canonicalCommitTarget:'HOMEBASE'};
}
