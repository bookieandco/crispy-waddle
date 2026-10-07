import {
  evaluateDirectorHumanMediaHealth,
  validateDirectorHumanMediaExecutionReceipt,
  validateDirectorHumanMediaJob,
  type DirectorHumanMediaExecutionReceipt,
  type DirectorHumanMediaHealthReceipt,
  type DirectorHumanMediaJobRequest,
  type DirectorHumanMediaRuntimeBundle,
} from '@jhadina/director-core/human-media-worker-contract';
import { resolveDirectorHunyuanRuntimeConfig } from './director-hunyuan-video-provider';
import {
  validateDirectorHumanMediaDeploymentParity,
  type DirectorHumanMediaDeployment,
  type DirectorHumanMediaDeploymentTier,
} from '@jhadina/compute-core';

export type DirectorHumanMediaWorkerClientConfig=Readonly<{
  baseUrl:string;
  token?:string;
}>;

export type DirectorHumanMediaDeploymentProbeInput=Readonly<{
  id:string;
  tier:DirectorHumanMediaDeploymentTier;
  bundle:DirectorHumanMediaRuntimeBundle;
  client:DirectorHumanMediaWorkerClient;
  nodeId?:string;
  runpodEndpointId?:string;
}>;

export type DirectorHumanMediaDeploymentPairProbe=Readonly<{
  homebase:DirectorHumanMediaDeployment;
  burst?:DirectorHumanMediaDeployment;
  parityReasons:readonly string[];
  burstAdmissible:boolean;
}>;

function cleanBaseUrl(value:string):string{
  return value.replace(/\/+$/,'');
}

function assertHttpUrl(value:string):void{
  let parsed:URL;
  try{ parsed=new URL(value); }catch{ throw new Error('DIRECTOR_HUMAN_MEDIA_WORKER_URL_INVALID'); }
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password){
    throw new Error('DIRECTOR_HUMAN_MEDIA_WORKER_URL_INVALID');
  }
}

export class DirectorHumanMediaWorkerClient{
  readonly endpoint:string;

  constructor(private readonly config:DirectorHumanMediaWorkerClientConfig){
    assertHttpUrl(config.baseUrl);
    this.endpoint=cleanBaseUrl(config.baseUrl);
  }

  private headers(extra:Record<string,string>={}):Record<string,string>{
    return {
      ...extra,
      ...(this.config.token?{authorization:`Bearer ${this.config.token}`}:{}),
    };
  }

  async health():Promise<DirectorHumanMediaHealthReceipt>{
    const response=await fetch(`${this.endpoint}/health`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok)throw new Error(`DIRECTOR_HUMAN_MEDIA_HEALTH_FAILED:${response.status}`);
    return await response.json() as DirectorHumanMediaHealthReceipt;
  }

  async submit(
    request:DirectorHumanMediaJobRequest,
    idempotencyKey:string,
  ):Promise<DirectorHumanMediaExecutionReceipt>{
    const reasons=validateDirectorHumanMediaJob(request);
    if(reasons.length)throw new Error(`DIRECTOR_HUMAN_MEDIA_JOB_INVALID:${reasons.join(',')}`);
    if(!idempotencyKey.trim())throw new Error('DIRECTOR_HUMAN_MEDIA_IDEMPOTENCY_KEY_REQUIRED');
    const response=await fetch(`${this.endpoint}/v1/jobs`,{
      method:'POST',
      headers:this.headers({
        'content-type':'application/json',
        'idempotency-key':idempotencyKey,
      }),
      body:JSON.stringify({request}),
    });
    if(!response.ok)throw new Error(`DIRECTOR_HUMAN_MEDIA_SUBMIT_FAILED:${response.status}`);
    return await response.json() as DirectorHumanMediaExecutionReceipt;
  }

  async status(providerJobId:string):Promise<DirectorHumanMediaExecutionReceipt>{
    if(!providerJobId.trim())throw new Error('DIRECTOR_HUMAN_MEDIA_PROVIDER_JOB_ID_REQUIRED');
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok)throw new Error(`DIRECTOR_HUMAN_MEDIA_STATUS_FAILED:${response.status}`);
    return await response.json() as DirectorHumanMediaExecutionReceipt;
  }

  async download(providerJobId:string):Promise<{bytes:Uint8Array;contentType:string}>{
    if(!providerJobId.trim())throw new Error('DIRECTOR_HUMAN_MEDIA_PROVIDER_JOB_ID_REQUIRED');
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}/artifact`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok)throw new Error(`DIRECTOR_HUMAN_MEDIA_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes:new Uint8Array(await response.arrayBuffer()),
      contentType:response.headers.get('content-type')??'application/octet-stream',
    };
  }

  async cancel(providerJobId:string):Promise<void>{
    if(!providerJobId.trim())throw new Error('DIRECTOR_HUMAN_MEDIA_PROVIDER_JOB_ID_REQUIRED');
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      method:'DELETE',
      headers:this.headers(),
    });
    if(!response.ok&&response.status!==404){
      throw new Error(`DIRECTOR_HUMAN_MEDIA_CANCEL_FAILED:${response.status}`);
    }
  }
}

export async function probeDirectorHumanMediaDeployment(
  input:DirectorHumanMediaDeploymentProbeInput,
):Promise<DirectorHumanMediaDeployment>{
  if(input.tier==='gpu-burst'&&!input.client.endpoint.startsWith('https://')){
    throw new Error('DIRECTOR_HUMAN_MEDIA_BURST_HTTPS_REQUIRED');
  }
  const health=await input.client.health();
  const reasons=evaluateDirectorHumanMediaHealth(input.bundle,health);
  return Object.freeze({
    id:input.id,
    engine:input.bundle.engine,
    tier:input.tier,
    baseUrl:input.client.endpoint,
    image:input.bundle.image,
    imageDigest:health.imageDigest,
    sourceRevision:health.sourceRevision,
    modelArtifactDigests:Object.freeze([...health.modelArtifactSha256s]),
    productionReady:reasons.length===0,
    healthObservedAt:health.observedAt,
    ...(input.nodeId?{nodeId:input.nodeId}:{}),
    ...(input.runpodEndpointId?{runpodEndpointId:input.runpodEndpointId}:{}),
  });
}

export async function probeDirectorHumanMediaDeploymentPair(input:{
  homebase:DirectorHumanMediaDeploymentProbeInput;
  burst?:DirectorHumanMediaDeploymentProbeInput;
}):Promise<DirectorHumanMediaDeploymentPairProbe>{
  const homebase=await probeDirectorHumanMediaDeployment(input.homebase);
  if(!input.burst){
    return Object.freeze({
      homebase,
      parityReasons:Object.freeze([]),
      burstAdmissible:false,
    });
  }
  const burst=await probeDirectorHumanMediaDeployment(input.burst);
  const parityReasons=validateDirectorHumanMediaDeploymentParity(homebase,burst);
  return Object.freeze({
    homebase,
    burst,
    parityReasons,
    burstAdmissible:burst.productionReady&&parityReasons.length===0,
  });
}

export function assertDirectorHumanMediaExecutionReceipt(
  request:DirectorHumanMediaJobRequest,
  bundle:DirectorHumanMediaRuntimeBundle,
  receipt:DirectorHumanMediaExecutionReceipt,
):void{
  const reasons=validateDirectorHumanMediaExecutionReceipt(request,bundle,receipt);
  if(reasons.length){
    throw new Error(`DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT_INVALID:${reasons.join(',')}`);
  }
}


export type DirectorHumanMediaRuntimeResolution=Readonly<{
  config:DirectorHumanMediaWorkerClientConfig;
  source:'environment'|'swlc-hunyuan-sidecar';
}>;

function admittedHumanMediaWorkerUrl(value:unknown):string|undefined{
  if(typeof value!=='string'||!value.trim())return undefined;
  try{
    const parsed=new URL(value.trim());
    if(parsed.username||parsed.password)return undefined;
    const loopback=
      parsed.protocol==='http:'&&
      ['127.0.0.1','localhost','::1'].includes(parsed.hostname);
    if(parsed.protocol!=='https:'&&!loopback)return undefined;
    parsed.pathname=parsed.pathname.replace(/\/+$/,'');
    parsed.search='';
    parsed.hash='';
    return cleanBaseUrl(parsed.toString());
  }catch{
    return undefined;
  }
}

export async function resolveConfiguredDirectorHumanMediaWorkerConfig():Promise<DirectorHumanMediaRuntimeResolution|undefined>{
  const toggle=(process.env.DIRECTOR_HUMAN_MEDIA_CANONICAL_ENABLED??'').trim().toLowerCase();
  if(['0','false','no','off'].includes(toggle))return undefined;

  const explicit=admittedHumanMediaWorkerUrl(process.env.DIRECTOR_HUMAN_MEDIA_WORKER_URL);
  if(explicit){
    const token=(
      process.env.DIRECTOR_HUMAN_MEDIA_WORKER_TOKEN?.trim()||
      (await resolveDirectorHunyuanRuntimeConfig()).config.token
    );
    return Object.freeze({
      config:Object.freeze({
        baseUrl:explicit,
        ...(token?{token}:{}),
      }),
      source:'environment',
    });
  }

  const hunyuan=await resolveDirectorHunyuanRuntimeConfig();
  if(hunyuan.source!=='swlc-runtime-binding')return undefined;
  const baseUrl=admittedHumanMediaWorkerUrl(hunyuan.config.baseUrl+'/human-media');
  if(!baseUrl)return undefined;
  return Object.freeze({
    config:Object.freeze({
      baseUrl,
      ...(hunyuan.config.token?{token:hunyuan.config.token}:{}),
    }),
    source:'swlc-hunyuan-sidecar',
  });
}

export async function createConfiguredDirectorHumanMediaWorkerClient():Promise<DirectorHumanMediaWorkerClient|undefined>{
  const runtime=await resolveConfiguredDirectorHumanMediaWorkerConfig();
  return runtime?new DirectorHumanMediaWorkerClient(runtime.config):undefined;
}

export async function requireConfiguredDirectorHumanMediaWorkerClient():Promise<DirectorHumanMediaWorkerClient>{
  const client=await createConfiguredDirectorHumanMediaWorkerClient();
  if(!client)throw new Error('DIRECTOR_HUMAN_MEDIA_RUNTIME_NOT_CONFIGURED');
  return client;
}
