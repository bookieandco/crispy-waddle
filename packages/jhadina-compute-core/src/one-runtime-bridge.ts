import type {
  ComputeQueueClass,
  ComputeWorkload,
  ComputeWorkloadKind,
} from './resource-contract.js';
import {
  resolveComputeWorkload,
  type ComputeExecutionConstraints,
  type ComputeResourceProfileCatalog,
} from './resource-profile.js';

export type OneRuntimeTaskDescriptor = {
  id:string;
  workSessionId:string;
  domain:string;
  capability:string;
  idempotencyKey:string;
  status:string;
  leaseOwner?:string;
  leaseToken?:string;
  leaseExpiresAt?:string;
  createdAt:string;
  updatedAt?:string;
};

export type OneRuntimeComputeBinding = {
  source:ComputeWorkload['source'];
  kind:ComputeWorkloadKind;
  resourceProfileId:string;
  queue?:ComputeQueueClass;
  requestedPriority?:number;
  constraints?:ComputeExecutionConstraints;
  dataLocalityKeys?:readonly string[];
  preferredNodeIds?:readonly string[];
  forbiddenNodeIds?:readonly string[];
};

/**
 * Describes compute for an already-created ONE-RUNTIME task.
 * It never creates, authorizes, claims or executes the task.
 */
export function describeComputeWorkloadForTask(
  task:OneRuntimeTaskDescriptor,
  binding:OneRuntimeComputeBinding,
  profiles:ComputeResourceProfileCatalog,
  nowIso?:string,
):ComputeWorkload {
  if(!task.workSessionId.trim()||!task.id.trim()||!task.idempotencyKey.trim()){
    throw new Error('COMPUTE_TASK_LINEAGE_REQUIRED');
  }
  const now=Date.parse(nowIso??new Date().toISOString());
  if(
    task.status!=='running'||
    !task.leaseOwner?.trim()||
    !task.leaseToken?.trim()||
    !task.leaseExpiresAt||
    !Number.isFinite(now)||
    Date.parse(task.leaseExpiresAt)<=now
  ){
    throw new Error('COMPUTE_TASK_ACTIVE_LEASE_REQUIRED');
  }
  return resolveComputeWorkload({
    id:`one-runtime:${task.workSessionId}:${task.id}`,
    source:binding.source,
    kind:binding.kind,
    authority:{
      system:'jhadina-one-runtime',
      jobId:task.id,
      idempotencyKey:task.idempotencyKey,
      projectId:task.workSessionId,
    },
    resourceProfileId:binding.resourceProfileId,
    queue:binding.queue,
    requestedPriority:binding.requestedPriority,
    constraints:binding.constraints,
    dataLocalityKeys:binding.dataLocalityKeys,
    preferredNodeIds:binding.preferredNodeIds,
    forbiddenNodeIds:binding.forbiddenNodeIds,
    createdAt:task.updatedAt??task.createdAt,
  },profiles);
}
