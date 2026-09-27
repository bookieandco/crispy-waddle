import { validateComputeStorageLineage } from './data-path-lineage.js';
import type { ComputeWorkload, PlacementPlan } from './resource-contract.js';
import type { StorageIntent, StoragePlan } from './storage-contract.js';

export type ComputeExecutionTarget='kubernetes-job'|'ray-job'|'long-lived-service';

export type ComputeWorkerSpec={
  image:string;
  imageDigest?:string;
  command?:readonly string[];
  args?:readonly string[];
  serviceAccountName?:string;
  envSecretRefs?:readonly string[];
};

export type ComputeExecutionBundle={
  workload:ComputeWorkload;
  storageIntent:StorageIntent;
  storagePlan:StoragePlan;
  placement:PlacementPlan;
  target:ComputeExecutionTarget;
  worker:ComputeWorkerSpec;
  mode:'shadow'|'live';
};

export type ComputeActionRuntimeLineage={
  workSessionId:string;
  taskId:string;
  correlationId:string;
  idempotencyKey:string;
};

export type ComputeExecutionPermit={
  actionRequestId:string;
  userId:string;
  authorizedAt:string;
  expiresAt:string;
  approvalReceiptId?:string;
  runtime:ComputeActionRuntimeLineage;
};

export type ComputeSubmissionReceipt={
  submissionId:string;
  actionRequestId:string;
  workloadId:string;
  workSessionId:string;
  taskId:string;
  idempotencyKey:string;
  target:ComputeExecutionTarget;
  provider:'kubernetes'|'shadow';
  namespace:string;
  queueName:string;
  resourceName:string;
  selectedNodeId:string;
  primaryStorageBackendId:string;
  cacheStorageBackendId?:string;
  submittedAt:string;
  manifestFingerprint:string;
};

export type ComputeExecutionResultReceipt={
  submissionId:string;
  workloadId:string;
  status:'succeeded'|'failed'|'cancelled';
  startedAt:string;
  completedAt:string;
  outputRefs:readonly string[];
  telemetryRef?:string;
  errorCode?:string;
  retryable?:boolean;
};

function validIso(value:string):boolean{return Number.isFinite(Date.parse(value));}

export function validateComputeExecutionBundle(bundle:ComputeExecutionBundle):readonly string[]{
  const reasons:string[]=[];
  const lineage=validateComputeStorageLineage(bundle.workload,bundle.storageIntent);
  reasons.push(...lineage.reasons);
  if(bundle.placement.workloadId!==bundle.workload.id)reasons.push('COMPUTE_PLACEMENT_WORKLOAD_MISMATCH');
  if(!bundle.placement.selectedNodeId)reasons.push('COMPUTE_PLACEMENT_REQUIRED');
  if(bundle.storagePlan.intentId!==bundle.storageIntent.id)reasons.push('COMPUTE_STORAGE_PLAN_INTENT_MISMATCH');
  if(!bundle.storagePlan.admissible)reasons.push('COMPUTE_STORAGE_PLAN_NOT_ADMISSIBLE');
  if(!bundle.storagePlan.primaryBackendId)reasons.push('COMPUTE_PRIMARY_STORAGE_REQUIRED');
  if(!bundle.worker.image.trim())reasons.push('COMPUTE_WORKER_IMAGE_REQUIRED');
  if(bundle.mode==='live'&&!bundle.worker.imageDigest?.trim())reasons.push('COMPUTE_LIVE_IMAGE_DIGEST_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function validateComputeExecutionPermit(
  bundle:ComputeExecutionBundle,
  permit:ComputeExecutionPermit,
  nowIso:string,
):readonly string[]{
  const reasons:string[]=[...validateComputeExecutionBundle(bundle)];
  if(!validIso(nowIso)||!validIso(permit.authorizedAt)||!validIso(permit.expiresAt)){
    reasons.push('COMPUTE_PERMIT_TIME_INVALID');
  }else{
    const now=Date.parse(nowIso);
    if(Date.parse(permit.authorizedAt)>now)reasons.push('COMPUTE_PERMIT_NOT_YET_VALID');
    if(Date.parse(permit.expiresAt)<=now)reasons.push('COMPUTE_PERMIT_EXPIRED');
  }
  if(bundle.workload.authority.system==='jhadina-one-runtime'){
    if(permit.runtime.taskId!==bundle.workload.authority.jobId)reasons.push('COMPUTE_PERMIT_TASK_MISMATCH');
    if(permit.runtime.workSessionId!==bundle.workload.authority.projectId)reasons.push('COMPUTE_PERMIT_SESSION_MISMATCH');
    if(permit.runtime.idempotencyKey!==bundle.workload.authority.idempotencyKey)reasons.push('COMPUTE_PERMIT_IDEMPOTENCY_MISMATCH');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function assertComputeExecutionAuthorized(
  bundle:ComputeExecutionBundle,
  permit:ComputeExecutionPermit,
  nowIso:string,
):void{
  const reasons=validateComputeExecutionPermit(bundle,permit,nowIso);
  if(reasons.length)throw new Error(`COMPUTE_EXECUTION_NOT_AUTHORIZED:${reasons.join(',')}`);
}
