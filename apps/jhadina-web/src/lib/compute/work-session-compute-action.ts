import type { ActionRequest } from '@jhadina/action-core';
import type { WorkSessionTask } from '@jhadina/core-spine';
import type { ComputeExecutionBundle } from '@jhadina/compute-core';
import { bindActionRequestToWorkSessionTask } from '../runtime/work-session-action';
import { COMPUTE_SUBMIT_ACTION } from './compute-action-handler';

export type WorkSessionComputeActionInput={
  actionRequestId:string;
  requestedAt:string;
  approvalReceiptId?:string;
};

export function computeActionRequestFromWorkSessionTask(
  task:WorkSessionTask,
  bundle:ComputeExecutionBundle,
  input:WorkSessionComputeActionInput,
):ActionRequest<ComputeExecutionBundle>{
  if(task.status!=='running')throw new Error(`COMPUTE_TASK_NOT_RUNNING:${task.status}`);
  if(!task.leaseOwner?.trim()||!task.leaseToken?.trim()||!task.leaseExpiresAt){
    throw new Error('COMPUTE_TASK_ACTIVE_LEASE_REQUIRED');
  }
  if(Date.parse(task.leaseExpiresAt)<=Date.parse(input.requestedAt)){
    throw new Error('COMPUTE_TASK_LEASE_EXPIRED');
  }
  const authority=bundle.workload.authority;
  if(authority.system!=='jhadina-one-runtime')throw new Error('COMPUTE_ONE_RUNTIME_AUTHORITY_REQUIRED');
  if(authority.jobId!==task.id)throw new Error('COMPUTE_TASK_WORKLOAD_TASK_MISMATCH');
  if(authority.projectId!==task.workSessionId)throw new Error('COMPUTE_TASK_WORKLOAD_SESSION_MISMATCH');
  if(authority.idempotencyKey!==task.idempotencyKey)throw new Error('COMPUTE_TASK_WORKLOAD_IDEMPOTENCY_MISMATCH');

  return bindActionRequestToWorkSessionTask({
    id:input.actionRequestId,
    userId:task.ownerUserId,
    type:COMPUTE_SUBMIT_ACTION,
    action:bundle,
    requestedAt:input.requestedAt,
    approvalReceiptId:input.approvalReceiptId,
  },task);
}
