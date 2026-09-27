import type {
  ComputeExecutionBundle,
  ComputeExecutionPermit,
  ComputeSubmissionReceipt,
} from './execution-contract.js';

export type KubernetesResourceQuantity=string;

export type KubernetesJobManifest={
  apiVersion:'batch/v1';
  kind:'Job';
  metadata:{
    name:string;
    namespace:string;
    labels:Record<string,string>;
    annotations:Record<string,string>;
  };
  spec:{
    backoffLimit:number;
    ttlSecondsAfterFinished:number;
    template:{
      metadata:{labels:Record<string,string>;annotations:Record<string,string>};
      spec:{
        restartPolicy:'Never';
        priorityClassName:string;
        serviceAccountName?:string;
        nodeSelector:Record<string,string>;
        containers:Array<{
          name:string;
          image:string;
          command?:readonly string[];
          args?:readonly string[];
          env:Array<{name:string;value:string}>;
          resources:{
            requests:Record<string,KubernetesResourceQuantity>;
            limits:Record<string,KubernetesResourceQuantity>;
          };
        }>;
      };
    };
  };
};

export type KubernetesSubmissionConfig={
  namespace:string;
  queueNames:Record<'interactive'|'creative'|'render'|'background'|'maintenance',string>;
  priorityClassNames:Record<'interactive'|'creative'|'render'|'background'|'maintenance',string>;
  providerNodeLabels?:Partial<Record<'homebase'|'remote-homebase'|'cloud',Record<string,string>>>;
  ttlSecondsAfterFinished?:number;
  backoffLimit?:number;
};

export interface ComputeSubmitter{
  submit(bundle:ComputeExecutionBundle,permit:ComputeExecutionPermit):Promise<ComputeSubmissionReceipt>;
}

export interface KubernetesJobTransport{
  createJob(manifest:KubernetesJobManifest):Promise<{
    name:string;
    namespace:string;
    createdAt:string;
  }>;
}

function safeName(value:string):string{
  const normalized=value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
  return (normalized||'jhadina-job').slice(0,50);
}

function imageRef(image:string,digest:string|undefined):string{
  if(!digest)return image;
  const normalized=digest.startsWith('sha256:')?digest:`sha256:${digest}`;
  return `${image}@${normalized}`;
}

function fingerprint(input:string):string{
  let hash=2166136261;
  for(let i=0;i<input.length;i+=1){
    hash^=input.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return `fnv1a32:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function buildKueueJobManifest(
  bundle:ComputeExecutionBundle,
  permit:ComputeExecutionPermit,
  config:KubernetesSubmissionConfig,
):KubernetesJobManifest{
  const workload=bundle.workload;
  const queueName=config.queueNames[workload.queue];
  const priorityClassName=config.priorityClassNames[workload.queue];
  if(!queueName?.trim())throw new Error(`COMPUTE_KUEUE_QUEUE_REQUIRED:${workload.queue}`);
  if(!priorityClassName?.trim())throw new Error(`COMPUTE_PRIORITY_CLASS_REQUIRED:${workload.queue}`);
  const selected=bundle.placement.selectedNodeId;
  if(!selected)throw new Error('COMPUTE_PLACEMENT_REQUIRED');
  const primary=bundle.storagePlan.primaryBackendId;
  if(!primary)throw new Error('COMPUTE_PRIMARY_STORAGE_REQUIRED');

  const requests:Record<string,string>={
    cpu:String(workload.resources.cpuCores),
    memory:`${workload.resources.ramGiB}Gi`,
    'ephemeral-storage':`${Math.max(workload.resources.scratchGiB,1)}Gi`,
  };
  const limits:Record<string,string>={...requests};
  if(workload.resources.gpu){
    const resourceName=workload.resources.gpu.vendor==='amd'?'amd.com/gpu':'nvidia.com/gpu';
    requests[resourceName]=String(workload.resources.gpu.count);
    limits[resourceName]=String(workload.resources.gpu.count);
  }

  const labels:Record<string,string>={
    'app.kubernetes.io/part-of':'jhadina',
    'app.kubernetes.io/component':'compute-worker',
    'jhadina.ai/workload-id':workload.id,
    'jhadina.ai/work-session-id':permit.runtime.workSessionId,
    'jhadina.ai/task-id':permit.runtime.taskId,
    'jhadina.ai/queue':workload.queue,
    'jhadina.ai/source':workload.source,
    'kueue.x-k8s.io/queue-name':queueName,
  };
  const annotations:Record<string,string>={
    'jhadina.ai/action-request-id':permit.actionRequestId,
    'jhadina.ai/idempotency-key':permit.runtime.idempotencyKey,
    'jhadina.ai/planned-node-id':selected,
    'jhadina.ai/storage-primary':primary,
    'jhadina.ai/storage-cache':bundle.storagePlan.cacheBackendId??'none',
    'jhadina.ai/resource-profile':workload.resourceProfileId,
  };

  const nodeSelector:Record<string,string>={};
  if(workload.resources.networkFabric){
    nodeSelector['jhadina.ai/fabric']=workload.resources.networkFabric;
  }

  return {
    apiVersion:'batch/v1',
    kind:'Job',
    metadata:{
      name:safeName(`jhadina-${permit.runtime.taskId}-${workload.id}`),
      namespace:config.namespace,
      labels,
      annotations,
    },
    spec:{
      backoffLimit:config.backoffLimit??0,
      ttlSecondsAfterFinished:config.ttlSecondsAfterFinished??86400,
      template:{
        metadata:{labels:{...labels},annotations:{...annotations}},
        spec:{
          restartPolicy:'Never',
          priorityClassName,
          serviceAccountName:bundle.worker.serviceAccountName,
          nodeSelector,
          containers:[{
            name:'worker',
            image:imageRef(bundle.worker.image,bundle.worker.imageDigest),
            command:bundle.worker.command,
            args:bundle.worker.args,
            env:[
              {name:'JHADINA_WORKLOAD_ID',value:workload.id},
              {name:'JHADINA_WORK_SESSION_ID',value:permit.runtime.workSessionId},
              {name:'JHADINA_TASK_ID',value:permit.runtime.taskId},
              {name:'JHADINA_IDEMPOTENCY_KEY',value:permit.runtime.idempotencyKey},
              {name:'JHADINA_STORAGE_PRIMARY',value:primary},
              {name:'JHADINA_STORAGE_CACHE',value:bundle.storagePlan.cacheBackendId??''},
            ],
            resources:{requests,limits},
          }],
        },
      },
    },
  };
}

export function manifestFingerprint(manifest:KubernetesJobManifest):string{
  return fingerprint(JSON.stringify(manifest));
}

export class KubernetesComputeSubmitter implements ComputeSubmitter{
  constructor(
    private readonly transport:KubernetesJobTransport,
    private readonly config:KubernetesSubmissionConfig,
  ){}

  async submit(
    bundle:ComputeExecutionBundle,
    permit:ComputeExecutionPermit,
  ):Promise<ComputeSubmissionReceipt>{
    if(bundle.mode!=='live')throw new Error('COMPUTE_LIVE_SUBMITTER_REQUIRES_LIVE_MODE');
    const manifest=buildKueueJobManifest(bundle,permit,this.config);
    const created=await this.transport.createJob(manifest);
    const planned=bundle.placement.selectedNodeId;
    const primary=bundle.storagePlan.primaryBackendId;
    if(!planned||!primary)throw new Error('COMPUTE_SUBMISSION_PLAN_INCOMPLETE');
    return {
      submissionId:`k8s:${created.namespace}:${created.name}`,
      actionRequestId:permit.actionRequestId,
      workloadId:bundle.workload.id,
      workSessionId:permit.runtime.workSessionId,
      taskId:permit.runtime.taskId,
      idempotencyKey:permit.runtime.idempotencyKey,
      target:bundle.target,
      provider:'kubernetes',
      namespace:created.namespace,
      queueName:this.config.queueNames[bundle.workload.queue],
      resourceName:created.name,
      plannedNodeId:planned,
      primaryStorageBackendId:primary,
      cacheStorageBackendId:bundle.storagePlan.cacheBackendId,
      submittedAt:created.createdAt,
      manifestFingerprint:manifestFingerprint(manifest),
    };
  }
}

export class ShadowComputeSubmitter implements ComputeSubmitter{
  private readonly receipts=new Map<string,ComputeSubmissionReceipt>();

  async submit(
    bundle:ComputeExecutionBundle,
    permit:ComputeExecutionPermit,
  ):Promise<ComputeSubmissionReceipt>{
    if(bundle.mode!=='shadow')throw new Error('COMPUTE_SHADOW_SUBMITTER_REQUIRES_SHADOW_MODE');
    const existing=this.receipts.get(permit.runtime.idempotencyKey);
    if(existing)return existing;
    const planned=bundle.placement.selectedNodeId;
    const primary=bundle.storagePlan.primaryBackendId;
    if(!planned||!primary)throw new Error('COMPUTE_SUBMISSION_PLAN_INCOMPLETE');
    const receipt:ComputeSubmissionReceipt={
      submissionId:`shadow:${permit.runtime.workSessionId}:${permit.runtime.taskId}`,
      actionRequestId:permit.actionRequestId,
      workloadId:bundle.workload.id,
      workSessionId:permit.runtime.workSessionId,
      taskId:permit.runtime.taskId,
      idempotencyKey:permit.runtime.idempotencyKey,
      target:bundle.target,
      provider:'shadow',
      namespace:'jhadina-shadow',
      queueName:`jhadina-${bundle.workload.queue}`,
      resourceName:safeName(`shadow-${permit.runtime.taskId}`),
      plannedNodeId:planned,
      actualNodeId:planned,
      primaryStorageBackendId:primary,
      cacheStorageBackendId:bundle.storagePlan.cacheBackendId,
      submittedAt:permit.authorizedAt,
      manifestFingerprint:fingerprint(JSON.stringify({
        workload:bundle.workload.id,
        task:permit.runtime.taskId,
        planned,
        primary,
        cache:bundle.storagePlan.cacheBackendId,
        worker:bundle.worker.image,
      })),
    };
    this.receipts.set(permit.runtime.idempotencyKey,receipt);
    return receipt;
  }
}
