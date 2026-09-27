import type { KubernetesJobManifest, KubernetesJobTransport } from './kueue-submission.js';

export type FetchResponseLike={
  ok:boolean;
  status:number;
  json():Promise<unknown>;
  text():Promise<string>;
};

export type FetchLike=(
  input:string,
  init?:{
    method?:string;
    headers?:Record<string,string>;
    body?:string;
  },
)=>Promise<FetchResponseLike>;

export type KubernetesApiTransportConfig={
  baseUrl:string;
  bearerToken:string;
  fetchImpl?:FetchLike;
};

export type KubernetesJobObservation={
  name:string;
  namespace:string;
  phase:'pending'|'running'|'succeeded'|'failed'|'unknown';
  actualNodeId?:string;
  startedAt?:string;
  completedAt?:string;
  failureReason?:string;
};

type KubernetesObject=Record<string,unknown>;

function record(value:unknown):KubernetesObject{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as KubernetesObject:{};
}
function stringValue(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}

export class KubernetesApiJobTransport implements KubernetesJobTransport{
  private readonly fetchImpl:FetchLike;
  private readonly baseUrl:string;

  constructor(private readonly config:KubernetesApiTransportConfig){
    if(!config.baseUrl.trim())throw new Error('KUBERNETES_API_URL_REQUIRED');
    if(!config.bearerToken.trim())throw new Error('KUBERNETES_API_TOKEN_REQUIRED');
    this.baseUrl=config.baseUrl.replace(/\/+$/,'');
    const nativeFetch=(globalThis as {fetch?:FetchLike}).fetch;
    if(!config.fetchImpl&&!nativeFetch)throw new Error('KUBERNETES_API_FETCH_REQUIRED');
    this.fetchImpl=config.fetchImpl??nativeFetch!;
  }

  async createJob(manifest:KubernetesJobManifest):Promise<{name:string;namespace:string;createdAt:string}>{
    const url=`${this.baseUrl}/apis/batch/v1/namespaces/${encodeURIComponent(manifest.metadata.namespace)}/jobs`;
    const response=await this.fetchImpl(url,{
      method:'POST',
      headers:this.headers(),
      body:JSON.stringify(manifest),
    });
    if(response.status===409){
      const existing=await this.getJob(manifest.metadata.namespace,manifest.metadata.name);
      this.assertExistingJobMatches(manifest,existing);
      return {
        name:manifest.metadata.name,
        namespace:manifest.metadata.namespace,
        createdAt:stringValue(record(existing.metadata).creationTimestamp)??new Date().toISOString(),
      };
    }
    if(!response.ok)throw new Error(`KUBERNETES_JOB_CREATE_FAILED:${response.status}:${await response.text()}`);
    const body=record(await response.json());
    const metadata=record(body.metadata);
    return {
      name:stringValue(metadata.name)??manifest.metadata.name,
      namespace:stringValue(metadata.namespace)??manifest.metadata.namespace,
      createdAt:stringValue(metadata.creationTimestamp)??new Date().toISOString(),
    };
  }

  async observeJob(namespace:string,name:string):Promise<KubernetesJobObservation>{
    const [job,pods]=await Promise.all([
      this.getJob(namespace,name),
      this.listPodsForJob(namespace,name),
    ]);
    const status=record(job.status);
    const conditions=Array.isArray(status.conditions)?status.conditions.map(record):[];
    const failed=conditions.find(condition=>condition.type==='Failed'&&condition.status==='True');
    const complete=conditions.find(condition=>condition.type==='Complete'&&condition.status==='True');
    const pod=pods[0];
    const podSpec=record(pod?.spec);
    const podStatus=record(pod?.status);
    const podPhase=stringValue(podStatus.phase);
    let phase:KubernetesJobObservation['phase']='pending';
    if(failed)phase='failed';
    else if(complete)phase='succeeded';
    else if(podPhase==='Running')phase='running';
    else if(podPhase==='Failed')phase='failed';
    else if(podPhase==='Succeeded')phase='succeeded';
    else if(!podPhase)phase='unknown';
    return {
      name,
      namespace,
      phase,
      actualNodeId:stringValue(podSpec.nodeName),
      startedAt:stringValue(status.startTime)??stringValue(podStatus.startTime),
      completedAt:stringValue(status.completionTime),
      failureReason:stringValue(failed?.reason)??stringValue(failed?.message)??stringValue(podStatus.reason),
    };
  }

  async cancelJob(namespace:string,name:string):Promise<void>{
    const response=await this.fetchImpl(
      `${this.baseUrl}/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs/${encodeURIComponent(name)}?propagationPolicy=Background`,
      {method:'DELETE',headers:this.headers()},
    );
    if(!response.ok&&response.status!==404){
      throw new Error(`KUBERNETES_JOB_DELETE_FAILED:${response.status}:${await response.text()}`);
    }
  }


  private assertExistingJobMatches(manifest:KubernetesJobManifest,existing:KubernetesObject):void{
    const metadata=record(existing.metadata);
    const annotations=record(metadata.annotations);
    for(const key of [
      'jhadina.ai/workload-id',
      'jhadina.ai/work-session-id',
      'jhadina.ai/task-id',
      'jhadina.ai/idempotency-key',
      'jhadina.ai/action-request-id',
    ]){
      const expected=manifest.metadata.annotations[key];
      const actual=stringValue(annotations[key]);
      if(!expected||actual!==expected){
        throw new Error(`KUBERNETES_JOB_IDEMPOTENCY_CONFLICT:${key}`);
      }
    }
  }

  private async getJob(namespace:string,name:string):Promise<KubernetesObject>{
    const response=await this.fetchImpl(
      `${this.baseUrl}/apis/batch/v1/namespaces/${encodeURIComponent(namespace)}/jobs/${encodeURIComponent(name)}`,
      {headers:this.headers()},
    );
    if(!response.ok)throw new Error(`KUBERNETES_JOB_READ_FAILED:${response.status}:${await response.text()}`);
    return record(await response.json());
  }

  private async listPodsForJob(namespace:string,name:string):Promise<KubernetesObject[]>{
    const selector=encodeURIComponent(`batch.kubernetes.io/job-name=${name}`);
    const response=await this.fetchImpl(
      `${this.baseUrl}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods?labelSelector=${selector}`,
      {headers:this.headers()},
    );
    if(!response.ok)throw new Error(`KUBERNETES_POD_LIST_FAILED:${response.status}:${await response.text()}`);
    const body=record(await response.json());
    return Array.isArray(body.items)?body.items.map(record):[];
  }

  private headers():Record<string,string>{
    return {
      authorization:`Bearer ${this.config.bearerToken}`,
      'content-type':'application/json',
      accept:'application/json',
    };
  }
}
