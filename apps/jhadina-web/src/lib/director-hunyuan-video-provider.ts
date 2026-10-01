import { currentVercelOidcToken } from './vercel-oidc-runtime';
import {
  buildHunyuanVideo15Request,
  type BuildHunyuanVideo15RequestInput,
  type HunyuanVideo15Request,
} from '@jhadina/director-core/hunyuan-video-15-provider';

const DEFAULT_DIRECTOR_HUNYUAN_WORKER_URL='https://xn73vwwekavcc6-8091.proxy.runpod.net';

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

function directorHunyuanRuntimeConfig():DirectorHunyuanWorkerConfig{
  const url=process.env.DIRECTOR_HUNYUAN_WORKER_URL?.trim()||DEFAULT_DIRECTOR_HUNYUAN_WORKER_URL;
  const token=process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN?.trim()||currentVercelOidcToken()||undefined;
  return {baseUrl:url,token};
}

export function createDirectorHunyuanHealthProvider():DirectorHunyuanVideoProvider{
  return new DirectorHunyuanVideoProvider(directorHunyuanRuntimeConfig());
}

export function createConfiguredDirectorHunyuanVideoProvider():DirectorHunyuanVideoProvider|undefined{
  const enabled=['1','true','yes','on'].includes(
    (process.env.DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED??'').trim().toLowerCase(),
  );
  if(!enabled) return undefined;
  return new DirectorHunyuanVideoProvider(directorHunyuanRuntimeConfig());
}
