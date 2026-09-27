import type {
  ComputeExecutionRecord,
  ComputeExecutionRepository,
  ComputeExecutionResultReceipt,
  ComputeSubmissionReceipt,
} from '@jhadina/compute-core';

type RpcError={message:string};
export interface ComputeReceiptRpcClient{
  rpc(
    fn:string,
    args:Record<string,unknown>,
  ):PromiseLike<{data:unknown;error:RpcError|null}>;
}

type Row=Record<string,unknown>;

function row(value:unknown):Row|null{
  if(Array.isArray(value))return value.length?row(value[0]):null;
  return value&&typeof value==='object'?value as Row:null;
}
function requiredString(value:unknown,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(`COMPUTE_RECEIPT_ROW_INVALID:${field}`);
  return value;
}
function optionalString(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}
function optionalBoolean(value:unknown):boolean|undefined{
  return typeof value==='boolean'?value:undefined;
}
function stringArray(value:unknown):readonly string[]{
  if(!Array.isArray(value))return Object.freeze([]);
  return Object.freeze(value.filter((item):item is string=>typeof item==='string'));
}

function submissionFromRow(value:unknown):ComputeSubmissionReceipt{
  const r=row(value);
  if(!r)throw new Error('COMPUTE_RECEIPT_ROW_REQUIRED');
  const target=requiredString(r.target,'target');
  if(target!=='kubernetes-job'&&target!=='ray-job'&&target!=='long-lived-service'){
    throw new Error('COMPUTE_RECEIPT_ROW_INVALID:target');
  }
  const provider=requiredString(r.provider,'provider');
  if(provider!=='kubernetes'&&provider!=='shadow')throw new Error('COMPUTE_RECEIPT_ROW_INVALID:provider');
  return {
    submissionId:requiredString(r.submission_id,'submission_id'),
    actionRequestId:requiredString(r.action_request_id,'action_request_id'),
    userId:requiredString(r.owner_user_id,'owner_user_id'),
    workloadId:requiredString(r.workload_id,'workload_id'),
    workSessionId:requiredString(r.work_session_id,'work_session_id'),
    taskId:requiredString(r.task_id,'task_id'),
    idempotencyKey:requiredString(r.idempotency_key,'idempotency_key'),
    target,
    provider,
    namespace:requiredString(r.namespace,'namespace'),
    queueName:requiredString(r.queue_name,'queue_name'),
    resourceName:requiredString(r.resource_name,'resource_name'),
    plannedNodeId:requiredString(r.planned_node_id,'planned_node_id'),
    actualNodeId:optionalString(r.actual_node_id),
    primaryStorageBackendId:requiredString(r.primary_storage_backend_id,'primary_storage_backend_id'),
    cacheStorageBackendId:optionalString(r.cache_storage_backend_id),
    submittedAt:requiredString(r.submitted_at,'submitted_at'),
    manifestFingerprint:requiredString(r.manifest_fingerprint,'manifest_fingerprint'),
  };
}

function resultFromRow(value:unknown):ComputeExecutionResultReceipt|undefined{
  const r=row(value);
  if(!r||r.result_status===null||r.result_status===undefined)return undefined;
  const status=requiredString(r.result_status,'result_status');
  if(status!=='succeeded'&&status!=='failed'&&status!=='cancelled'){
    throw new Error('COMPUTE_RECEIPT_ROW_INVALID:result_status');
  }
  return {
    submissionId:requiredString(r.submission_id,'submission_id'),
    workloadId:requiredString(r.workload_id,'workload_id'),
    status,
    startedAt:requiredString(r.result_started_at,'result_started_at'),
    completedAt:requiredString(r.result_completed_at,'result_completed_at'),
    outputRefs:stringArray(r.output_refs),
    telemetryRef:optionalString(r.telemetry_ref),
    actualNodeId:optionalString(r.actual_node_id),
    errorCode:optionalString(r.error_code),
    retryable:optionalBoolean(r.retryable),
  };
}

export class SupabaseComputeExecutionRepository implements ComputeExecutionRepository{
  constructor(private readonly client:ComputeReceiptRpcClient){}

  async getByIdempotency(
    workSessionId:string,
    taskId:string,
    idempotencyKey:string,
  ):Promise<ComputeExecutionRecord|null>{
    const {data,error}=await this.client.rpc('jhadina_get_compute_execution',{
      p_work_session_id:workSessionId,
      p_task_id:taskId,
      p_idempotency_key:idempotencyKey,
    });
    if(error)throw new Error(`COMPUTE_RECEIPT_READ_FAILED:${error.message}`);
    const r=row(data);
    if(!r)return null;
    return {
      submission:submissionFromRow(r),
      result:resultFromRow(r),
      updatedAt:requiredString(r.updated_at,'updated_at'),
    };
  }

  async saveSubmission(receipt:ComputeSubmissionReceipt):Promise<void>{
    const {data,error}=await this.client.rpc('jhadina_record_compute_submission',{
      p_submission_id:receipt.submissionId,
      p_action_request_id:receipt.actionRequestId,
      p_owner_user_id:receipt.userId,
      p_workload_id:receipt.workloadId,
      p_work_session_id:receipt.workSessionId,
      p_task_id:receipt.taskId,
      p_idempotency_key:receipt.idempotencyKey,
      p_target:receipt.target,
      p_provider:receipt.provider,
      p_namespace:receipt.namespace,
      p_queue_name:receipt.queueName,
      p_resource_name:receipt.resourceName,
      p_planned_node_id:receipt.plannedNodeId,
      p_primary_storage_backend_id:receipt.primaryStorageBackendId,
      p_cache_storage_backend_id:receipt.cacheStorageBackendId??null,
      p_manifest_fingerprint:receipt.manifestFingerprint,
      p_submitted_at:receipt.submittedAt,
    });
    if(error)throw new Error(`COMPUTE_RECEIPT_SUBMISSION_WRITE_FAILED:${error.message}`);
    const stored=submissionFromRow(data);
    if(
      stored.submissionId!==receipt.submissionId||
      stored.workloadId!==receipt.workloadId||
      stored.manifestFingerprint!==receipt.manifestFingerprint
    )throw new Error('COMPUTE_EXECUTION_IDEMPOTENCY_CONFLICT');
  }

  async saveResult(
    receipt:ComputeExecutionResultReceipt,
    updatedAt:string,
  ):Promise<void>{
    const {data,error}=await this.client.rpc('jhadina_record_compute_result',{
      p_submission_id:receipt.submissionId,
      p_workload_id:receipt.workloadId,
      p_status:receipt.status,
      p_started_at:receipt.startedAt,
      p_completed_at:receipt.completedAt,
      p_output_refs:[...receipt.outputRefs],
      p_telemetry_ref:receipt.telemetryRef??null,
      p_error_code:receipt.errorCode??null,
      p_retryable:receipt.retryable??null,
      p_actual_node_id:receipt.actualNodeId??null,
    });
    if(error)throw new Error(`COMPUTE_RECEIPT_RESULT_WRITE_FAILED:${error.message}`);
    const stored=resultFromRow(data);
    if(!stored||stored.status!==receipt.status||stored.completedAt!==receipt.completedAt){
      throw new Error('COMPUTE_EXECUTION_RESULT_CONFLICT');
    }
    void updatedAt;
  }
}
