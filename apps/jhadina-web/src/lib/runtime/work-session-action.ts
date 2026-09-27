import type {ActionRequest,ActionRuntimeContext} from '@jhadina/action-core';
import type {WorkSessionTask} from '@jhadina/core-spine';

export function actionRuntimeContextFromTask(task:WorkSessionTask):ActionRuntimeContext{
  if(task.status!=='running'&&task.status!=='waiting-approval'){
    throw new Error(`ONE_RUNTIME_ACTION_TASK_NOT_EXECUTABLE:${task.status}`);
  }
  return Object.freeze({
    workSessionId:task.workSessionId,
    taskId:task.id,
    correlationId:task.correlationId,
    causationId:task.causationId,
    domain:task.domain,
    capability:task.capability,
    idempotencyKey:task.idempotencyKey,
  });
}

/**
 * Bind an already-governed Action Core request to the active WorkSession task.
 * This standardizes trace lineage only; it cannot approve or execute the action.
 */
export function bindActionRequestToWorkSessionTask<TAction>(
  request:ActionRequest<TAction>,
  task:WorkSessionTask,
):ActionRequest<TAction>{
  if(request.userId!==task.ownerUserId)throw new Error('ONE_RUNTIME_ACTION_OWNER_MISMATCH');
  const expected=actionRuntimeContextFromTask(task);
  if(request.runtimeContext)assertActionRuntimeContextMatches(expected,request.runtimeContext);
  return Object.freeze({...request,runtimeContext:expected});
}

export function assertActionRequestBoundToWorkSessionTask(
  request:ActionRequest<unknown>,
  task:WorkSessionTask,
):void{
  if(request.userId!==task.ownerUserId)throw new Error('ONE_RUNTIME_ACTION_OWNER_MISMATCH');
  if(!request.runtimeContext)throw new Error('ONE_RUNTIME_ACTION_RUNTIME_CONTEXT_REQUIRED');
  assertActionRuntimeContextMatches(actionRuntimeContextFromTask(task),request.runtimeContext);
}

function assertActionRuntimeContextMatches(expected:ActionRuntimeContext,actual:ActionRuntimeContext):void{
  const fields:(keyof ActionRuntimeContext)[]=[
    'workSessionId','taskId','correlationId','causationId','domain','capability','idempotencyKey',
  ];
  for(const field of fields){
    if((actual[field]??undefined)!==(expected[field]??undefined)){
      throw new Error(`ONE_RUNTIME_ACTION_LINEAGE_MISMATCH:${field}`);
    }
  }
}
