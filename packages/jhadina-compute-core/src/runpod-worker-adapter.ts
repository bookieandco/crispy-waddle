import type {HomebaseJobEnvelope,HomebaseExecutionTarget} from './homebase-router.js';

export type RunpodWorkerDispatch={
  provider:'RUNPOD';
  mode:'POD'|'SERVERLESS';
  jobId:string;
  endpoint?:string;
  endpointId?:string;
  compute:'CPU'|'GPU';
  networkVolumeRequired:boolean;
  apiKeyRef:'secret:RUNPOD_API_KEY';
  payload:{input:Record<string,unknown>};
  authority:'EXECUTION_ONLY';
};

export function buildRunpodWorkerDispatch(
  job:HomebaseJobEnvelope,
  target:Extract<HomebaseExecutionTarget,'RUNPOD_CPU'|'RUNPOD_GPU'>,
  input:Record<string,unknown>,
  options:{endpointId?:string;podProxyUrl?:string;networkVolumeRequired?:boolean}={},
):RunpodWorkerDispatch{
  if(job.sensitive)throw new Error('RUNPOD_SENSITIVE_JOB_FORBIDDEN');
  if(!job.cloudBurstAllowed)throw new Error('RUNPOD_CLOUD_BURST_NOT_AUTHORIZED');
  if(target==='RUNPOD_CPU'){
    if(!options.podProxyUrl?.startsWith('https://'))throw new Error('RUNPOD_CPU_PROXY_URL_REQUIRED');
    return Object.freeze({
      provider:'RUNPOD',mode:'POD',jobId:job.id,endpoint:options.podProxyUrl,
      compute:'CPU',networkVolumeRequired:options.networkVolumeRequired??true,
      apiKeyRef:'secret:RUNPOD_API_KEY',payload:{input},authority:'EXECUTION_ONLY',
    });
  }
  if(!options.endpointId?.trim())throw new Error('RUNPOD_GPU_ENDPOINT_ID_REQUIRED');
  return Object.freeze({
    provider:'RUNPOD',mode:'SERVERLESS',jobId:job.id,
    endpointId:options.endpointId,compute:'GPU',networkVolumeRequired:false,
    apiKeyRef:'secret:RUNPOD_API_KEY',payload:{input},authority:'EXECUTION_ONLY',
  });
}

export function runpodServerlessRunUrl(endpointId:string):string{
  if(!/^[A-Za-z0-9_-]+$/.test(endpointId))throw new Error('RUNPOD_ENDPOINT_ID_INVALID');
  return 'https://api.runpod.ai/v2/'+endpointId+'/run';
}
