import { currentVercelOidcToken } from './vercel-oidc-runtime';
import {
  buildHunyuanVideo15Request,
  type BuildHunyuanVideo15RequestInput,
  type HunyuanVideo15Request,
} from '@jhadina/director-core/hunyuan-video-15-provider';

const DEFAULT_DIRECTOR_HUNYUAN_WORKER_URL='https://xn73vwwekavcc6-8091.proxy.runpod.net';
const DIRECTOR_BONEZ_GATEWAY_URL='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

export interface DirectorHunyuanWorkerConfig {
  baseUrl:string;
  token?:string;
}

export interface DirectorHunyuanWorkerResult {
  providerJobId:string;
  status:'queued'|'processing'|'ready'|'failed'|'cancelled';
  requestId?:string;
  projectId?:string;
  model?:string;
  modelVersion?:string;
  resultUri?:string;
  runtimeReceiptId?:string;
  outputSha256?:string;
  measuredDurationSeconds?:number;
  qualityClaim?:boolean;
  error?:string;
  metadata?:Readonly<Record<string,unknown>>;
}

function cleanBaseUrl(value:string):string {
  return value.replace(/\/+$/,'');
}

export class DirectorHunyuanVideoProvider {
  readonly id='hunyuan-video-1.5';
  readonly productionQualityEligible=true;

  private readonly endpoint:string;

  constructor(private readonly config:DirectorHunyuanWorkerConfig){
    this.endpoint=cleanBaseUrl(config.baseUrl);
  }

  private headers(extra:Record<string,string>={}):Record<string,string>{
    return {
      ...extra,
      ...(this.config.token?{authorization:`Bearer ${this.config.token}`}:{}),
    };
  }

  async health():Promise<Readonly<Record<string,unknown>>>{
    const response=await fetch(`${this.endpoint}/health`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_HUNYUAN_HEALTH_FAILED:${response.status}`);
    return await response.json() as Readonly<Record<string,unknown>>;
  }

  async submit(
    input:BuildHunyuanVideo15RequestInput,
    idempotencyKey:string,
  ):Promise<DirectorHunyuanWorkerResult>{
    const request:HunyuanVideo15Request=buildHunyuanVideo15Request(input);
    const response=await fetch(`${this.endpoint}/v1/jobs`,{
      method:'POST',
      headers:this.headers({
        'content-type':'application/json',
        'idempotency-key':idempotencyKey,
      }),
      body:JSON.stringify({request}),
    });
    if(!response.ok) throw new Error(`DIRECTOR_HUNYUAN_SUBMIT_FAILED:${response.status}`);
    const body=await response.json() as Partial<DirectorHunyuanWorkerResult>;
    if(!body.providerJobId) throw new Error('DIRECTOR_HUNYUAN_PROVIDER_JOB_ID_MISSING');
    return {
      providerJobId:body.providerJobId,
      status:body.status??'queued',
      ...(body.requestId?{requestId:body.requestId}:{}),
      ...(body.projectId?{projectId:body.projectId}:{}),
      ...(body.model?{model:body.model}:{}),
      ...(body.modelVersion?{modelVersion:body.modelVersion}:{}),
      ...(body.resultUri?{resultUri:body.resultUri}:{}),
      ...(body.runtimeReceiptId?{runtimeReceiptId:body.runtimeReceiptId}:{}),
      ...(body.outputSha256?{outputSha256:body.outputSha256}:{}),
      ...(body.measuredDurationSeconds!==undefined?{measuredDurationSeconds:Number(body.measuredDurationSeconds)}:{}),
      ...(body.qualityClaim!==undefined?{qualityClaim:body.qualityClaim}:{}),
      ...(body.error?{error:body.error}:{}),
      ...(body.metadata?{metadata:body.metadata}:{}),
    };
  }

  async status(providerJobId:string):Promise<DirectorHunyuanWorkerResult>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_HUNYUAN_STATUS_FAILED:${response.status}`);
    const body=await response.json() as Partial<DirectorHunyuanWorkerResult>;
    return {
      providerJobId,
      status:body.status??'processing',
      ...(body.requestId?{requestId:body.requestId}:{}),
      ...(body.projectId?{projectId:body.projectId}:{}),
      ...(body.model?{model:body.model}:{}),
      ...(body.modelVersion?{modelVersion:body.modelVersion}:{}),
      ...(body.resultUri?{resultUri:body.resultUri}:{}),
      ...(body.runtimeReceiptId?{runtimeReceiptId:body.runtimeReceiptId}:{}),
      ...(body.outputSha256?{outputSha256:body.outputSha256}:{}),
      ...(body.measuredDurationSeconds!==undefined?{measuredDurationSeconds:Number(body.measuredDurationSeconds)}:{}),
      ...(body.qualityClaim!==undefined?{qualityClaim:body.qualityClaim}:{}),
      ...(body.error?{error:body.error}:{}),
      ...(body.metadata?{metadata:body.metadata}:{}),
    };
  }

  async download(providerJobId:string):Promise<{bytes:Uint8Array;contentType:string}>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}/artifact`,{
      headers:this.headers(),
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_HUNYUAN_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes:new Uint8Array(await response.arrayBuffer()),
      contentType:response.headers.get('content-type')??'video/mp4',
    };
  }

  async cancel(providerJobId:string):Promise<void>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      method:'DELETE',
      headers:this.headers(),
    });
    if(!response.ok&&response.status!==404) throw new Error(`DIRECTOR_HUNYUAN_CANCEL_FAILED:${response.status}`);
  }
}

export type DirectorHunyuanRuntimeResolution={
  config:DirectorHunyuanWorkerConfig;
  source:'environment'|'swlc-runtime-binding'|'legacy-default';
};

function admittedRunpodWorkerUrl(value:unknown):string|undefined{
  if(typeof value!=='string'||!value.trim()) return undefined;
  try{
    const parsed=new URL(value.trim());
    if(
      parsed.protocol!=='https:'
      ||!parsed.hostname.endsWith('.proxy.runpod.net')
      ||parsed.username
      ||parsed.password
    ) return undefined;
    parsed.pathname=parsed.pathname.replace(/\/+$/,'');
    parsed.search='';
    parsed.hash='';
    return cleanBaseUrl(parsed.toString());
  }catch{
    return undefined;
  }
}

async function discoverDirectorHunyuanWorkerUrl(oidc:string):Promise<string|undefined>{
  if(!oidc) return undefined;
  try{
    const response=await fetch(DIRECTOR_BONEZ_GATEWAY_URL,{
      method:'POST',
      headers:{
        authorization:`Bearer ${oidc}`,
        'content-type':'application/json',
      },
      body:JSON.stringify({action:'hunyuan-runtime-binding'}),
      cache:'no-store',
    });
    if(!response.ok) return undefined;
    const body=await response.json() as {configured?:boolean;baseUrl?:unknown};
    if(body.configured!==true) return undefined;
    return admittedRunpodWorkerUrl(body.baseUrl);
  }catch{
    return undefined;
  }
}

export async function resolveDirectorHunyuanRuntimeConfig():Promise<DirectorHunyuanRuntimeResolution>{
  const explicitUrl=admittedRunpodWorkerUrl(process.env.DIRECTOR_HUNYUAN_WORKER_URL);
  const staticToken=process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN?.trim();
  const oidc=(await currentVercelOidcToken())||undefined;
  const pinEnvironment=['1','true','yes','on'].includes(
    (process.env.DIRECTOR_HUNYUAN_WORKER_URL_PINNED??'').trim().toLowerCase(),
  );
  const discoveredUrl=pinEnvironment?undefined:await discoverDirectorHunyuanWorkerUrl(oidc??'');
  return {
    config:{
      baseUrl:discoveredUrl??explicitUrl??DEFAULT_DIRECTOR_HUNYUAN_WORKER_URL,
      token:staticToken||oidc||undefined,
    },
    source:discoveredUrl?'swlc-runtime-binding':explicitUrl?'environment':'legacy-default',
  };
}

export async function resolveConfiguredDirectorHunyuanWorkerConfig():Promise<DirectorHunyuanWorkerConfig|undefined>{
  const toggle=(process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED??'').trim().toLowerCase();
  if(['0','false','no','off'].includes(toggle)) return undefined;
  const runtime=await resolveDirectorHunyuanRuntimeConfig();
  const explicitlyEnabled=['1','true','yes','on'].includes(toggle);
  if(!explicitlyEnabled&&runtime.source!=='swlc-runtime-binding') return undefined;
  return runtime.config;
}

export async function createDirectorHunyuanHealthProvider():Promise<DirectorHunyuanVideoProvider>{
  return new DirectorHunyuanVideoProvider((await resolveDirectorHunyuanRuntimeConfig()).config);
}

export async function createConfiguredDirectorHunyuanVideoProvider():Promise<DirectorHunyuanVideoProvider|undefined>{
  const toggle=(process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED??'').trim().toLowerCase();
  if(['0','false','no','off'].includes(toggle)) return undefined;
  const config=await resolveConfiguredDirectorHunyuanWorkerConfig();
  return config?new DirectorHunyuanVideoProvider(config):undefined;
}
