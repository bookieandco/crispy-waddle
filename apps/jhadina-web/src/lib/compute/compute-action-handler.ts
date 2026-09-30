import type {
  ActionHandler,
  ActionRequest,
} from '@jhadina/action-core';
import {
  assertComputeExecutionAuthorized,
  type ComputeExecutionBundle,
  type ComputeExecutionPermit,
  type ComputeSubmissionReceipt,
  type ComputeSubmitter,
} from '@jhadina/compute-core';

export const COMPUTE_SUBMIT_ACTION='compute.submit' as const;

export type ComputeSubmitAction=ComputeExecutionBundle;

export class ComputeSubmitActionHandler implements ActionHandler<ComputeSubmitAction,ComputeSubmissionReceipt>{
  constructor(
    private readonly submitter:ComputeSubmitter,
    private readonly now:()=>string=()=>new Date().toISOString(),
    private readonly permitTtlMs=60_000,
  ){
    if(!Number.isFinite(permitTtlMs)||permitTtlMs<=0)throw new Error('COMPUTE_PERMIT_TTL_INVALID');
  }

  supports(type:string):boolean{return type===COMPUTE_SUBMIT_ACTION;}

  async execute(
    bundle:ComputeSubmitAction,
    request:ActionRequest<ComputeSubmitAction>,
  ):Promise<ComputeSubmissionReceipt>{
    if(request.type!==COMPUTE_SUBMIT_ACTION)throw new Error('COMPUTE_ACTION_TYPE_INVALID');
    if(bundle.workload.authority.system!=='jhadina-one-runtime'){
      throw new Error('COMPUTE_ONE_RUNTIME_AUTHORITY_REQUIRED');
    }
    const runtime=request.runtimeContext;
    if(!runtime?.taskId)throw new Error('COMPUTE_ACTION_RUNTIME_CONTEXT_REQUIRED');
    if(runtime.taskId!==bundle.workload.authority.jobId)throw new Error('COMPUTE_ACTION_TASK_MISMATCH');
    if(runtime.workSessionId!==bundle.workload.authority.projectId)throw new Error('COMPUTE_ACTION_SESSION_MISMATCH');
    if(runtime.idempotencyKey!==bundle.workload.authority.idempotencyKey)throw new Error('COMPUTE_ACTION_IDEMPOTENCY_MISMATCH');

    const authorizedAt=this.now();
    const permit:ComputeExecutionPermit={
      actionRequestId:request.id,
      userId:request.userId,
      authorizedAt,
      expiresAt:new Date(Date.parse(authorizedAt)+this.permitTtlMs).toISOString(),
      approvalReceiptId:request.approvalReceiptId,
      runtime:{
        workSessionId:runtime.workSessionId,
        taskId:runtime.taskId,
        correlationId:runtime.correlationId,
        idempotencyKey:runtime.idempotencyKey,
      },
    };
    assertComputeExecutionAuthorized(bundle,permit,authorizedAt);
    return this.submitter.submit(bundle,permit);
  }
}
