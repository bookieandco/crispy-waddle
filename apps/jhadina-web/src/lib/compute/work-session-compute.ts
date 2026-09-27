import type {WorkSessionTask} from '@jhadina/core-spine';
import type {
  ComputeExecutionConstraints,
  ComputeQueueClass,
  ComputeWorkloadDraft,
  ComputeWorkloadKind,
} from '@jhadina/compute-core';

export interface WorkSessionComputeBinding {
  source:ComputeWorkloadDraft['source'];
  kind:ComputeWorkloadKind;
  resourceProfileId:string;
  queue?:ComputeQueueClass;
  requestedPriority?:number;
  constraints?:ComputeExecutionConstraints;
  dataLocalityKeys?:readonly string[];
  preferredNodeIds?:readonly string[];
  forbiddenNodeIds?:readonly string[];
  createdAt?:string;
}

/**
 * Converts already-governed, compute-eligible WorkSession work into the
 * provider-neutral Compute Core vocabulary.
 *
 * This is a placement request only. It does not claim the task, start a worker,
 * authorize cloud spend, or authorize the task's real-world side effects.
 */
export function workSessionTaskComputeDraft(
  task:WorkSessionTask,
  binding:WorkSessionComputeBinding,
):ComputeWorkloadDraft{
  if(task.status!=='ready'&&task.status!=='retrying'){
    throw new Error(`ONE_RUNTIME_COMPUTE_TASK_NOT_DISPATCHABLE:${task.status}`);
  }
  if(!binding.resourceProfileId.trim())throw new Error('ONE_RUNTIME_COMPUTE_PROFILE_REQUIRED');
  return Object.freeze({
    id:`compute:work-session:${task.workSessionId}:${task.id}:v${task.version}`,
    source:binding.source,
    kind:binding.kind,
    queue:binding.queue,
    requestedPriority:binding.requestedPriority,
    authority:Object.freeze({
      system:'jhadina-work-session-task',
      jobId:`${task.workSessionId}:${task.id}`,
      idempotencyKey:task.idempotencyKey,
    }),
    resourceProfileId:binding.resourceProfileId,
    constraints:binding.constraints?Object.freeze({...binding.constraints}):undefined,
    dataLocalityKeys:unique([
      `work-session:${task.workSessionId}`,
      `task:${task.id}`,
      ...task.inputRefs.map(ref=>`input:${ref}`),
      ...(binding.dataLocalityKeys??[]),
    ]),
    preferredNodeIds:unique(binding.preferredNodeIds??[]),
    forbiddenNodeIds:unique(binding.forbiddenNodeIds??[]),
    createdAt:binding.createdAt??task.updatedAt,
  });
}

export function assertComputeDraftBoundToTask(
  task:WorkSessionTask,
  draft:ComputeWorkloadDraft,
):void{
  if(draft.authority.system!=='jhadina-work-session-task')throw new Error('ONE_RUNTIME_COMPUTE_AUTHORITY_SYSTEM_MISMATCH');
  if(draft.authority.jobId!==`${task.workSessionId}:${task.id}`)throw new Error('ONE_RUNTIME_COMPUTE_JOB_LINEAGE_MISMATCH');
  if(draft.authority.idempotencyKey!==task.idempotencyKey)throw new Error('ONE_RUNTIME_COMPUTE_IDEMPOTENCY_MISMATCH');
  if(!draft.dataLocalityKeys?.includes(`work-session:${task.workSessionId}`))throw new Error('ONE_RUNTIME_COMPUTE_WORK_SESSION_LOCALITY_MISSING');
  if(!draft.dataLocalityKeys.includes(`task:${task.id}`))throw new Error('ONE_RUNTIME_COMPUTE_TASK_LOCALITY_MISSING');
}

function unique(values:readonly string[]):readonly string[]{
  return Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))]);
}
