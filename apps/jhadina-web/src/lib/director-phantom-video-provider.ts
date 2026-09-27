import {
  buildPhantomVideoRequest,
  type BuildPhantomVideoRequestInput,
  type PhantomVideoRequest,
} from '@jhadina/director-core/phantom-video-provider';

export interface DirectorPhantomWorkerConfig {
  baseUrl: string;
  token?: string;
}

export interface DirectorPhantomWorkerResult {
  providerJobId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';
  resultUri?: string;
  modelVersion?: string;
  runtimeReceiptId?: string;
  error?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

function baseUrl(value:string):string {
  return value.replace(/\/+$/,'');
}

/**
 * Runtime adapter for the local/private Phantom worker.
 *
 * Phantom is deliberately a take/shot renderer. Long-form Director projects
 * orchestrate many admitted shots and never ask Phantom to synthesize a
 * 30-minute or 60-minute master in one generation request.
 */
export class DirectorPhantomVideoProvider {
  readonly id = 'phantom-wan';
  readonly productionQualityEligible = true;
  readonly maximumReferenceImages = 4;
  private readonly endpoint:string;

  constructor(private readonly config:DirectorPhantomWorkerConfig){
    this.endpoint=baseUrl(config.baseUrl);
  }

  async submit(
    input:BuildPhantomVideoRequestInput,
    idempotencyKey:string,
  ):Promise<DirectorPhantomWorkerResult>{
    const request:PhantomVideoRequest=buildPhantomVideoRequest(input);
    const response=await fetch(`${this.endpoint}/v1/jobs`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'idempotency-key':idempotencyKey,
        ...(this.config.token?{authorization:`Bearer ${this.config.token}`}:{}),
      },
      body:JSON.stringify({request}),
    });
    if(!response.ok) throw new Error(`DIRECTOR_PHANTOM_SUBMIT_FAILED:${response.status}`);
    const body=await response.json() as Partial<DirectorPhantomWorkerResult>;
    if(!body.providerJobId) throw new Error('DIRECTOR_PHANTOM_PROVIDER_JOB_ID_MISSING');
    return {
      providerJobId:body.providerJobId,
      status:body.status??'queued',
      ...(body.resultUri?{resultUri:body.resultUri}:{}),
      ...(body.modelVersion?{modelVersion:body.modelVersion}:{}),
      ...(body.runtimeReceiptId?{runtimeReceiptId:body.runtimeReceiptId}:{}),
      ...(body.error?{error:body.error}:{}),
      ...(body.metadata?{metadata:body.metadata}:{}),
    };
  }

  async status(providerJobId:string):Promise<DirectorPhantomWorkerResult>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      headers:this.config.token?{authorization:`Bearer ${this.config.token}`}:undefined,
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_PHANTOM_STATUS_FAILED:${response.status}`);
    const body=await response.json() as Partial<DirectorPhantomWorkerResult>;
    return {
      providerJobId,
      status:body.status??'processing',
      ...(body.resultUri?{resultUri:body.resultUri}:{}),
      ...(body.modelVersion?{modelVersion:body.modelVersion}:{}),
      ...(body.runtimeReceiptId?{runtimeReceiptId:body.runtimeReceiptId}:{}),
      ...(body.error?{error:body.error}:{}),
      ...(body.metadata?{metadata:body.metadata}:{}),
    };
  }

  async download(providerJobId:string):Promise<{bytes:Uint8Array;contentType:string}>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}/artifact`,{
      headers:this.config.token?{authorization:`Bearer ${this.config.token}`}:undefined,
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_PHANTOM_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes:new Uint8Array(await response.arrayBuffer()),
      contentType:response.headers.get('content-type')??'video/mp4',
    };
  }

  async cancel(providerJobId:string):Promise<void>{
    const response=await fetch(`${this.endpoint}/v1/jobs/${encodeURIComponent(providerJobId)}`,{
      method:'DELETE',
      headers:this.config.token?{authorization:`Bearer ${this.config.token}`}:undefined,
    });
    if(!response.ok&&response.status!==404) throw new Error(`DIRECTOR_PHANTOM_CANCEL_FAILED:${response.status}`);
  }
}

export function createConfiguredDirectorPhantomVideoProvider():DirectorPhantomVideoProvider|undefined{
  const url=process.env.DIRECTOR_PHANTOM_WORKER_URL?.trim();
  if(!url) return undefined;
  return new DirectorPhantomVideoProvider({
    baseUrl:url,
    token:process.env.DIRECTOR_PHANTOM_WORKER_TOKEN,
  });
}
