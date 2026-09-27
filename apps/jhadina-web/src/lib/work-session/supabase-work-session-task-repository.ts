import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeaseableWorkSessionTaskRepository,
  WorkSessionTask,
  WorkSessionTaskStatus,
  validateWorkSessionTaskGraph,
} from '@jhadina/core-spine';

type TaskRow = {
  id:string;
  work_session_id:string;
  owner_user_id:string;
  parent_task_id:string|null;
  domain:string;
  capability:string;
  status:WorkSessionTaskStatus;
  authority_ref:string;
  idempotency_key:string;
  correlation_id:string;
  causation_id:string|null;
  dependency_ids:unknown;
  input_refs:unknown;
  output_refs:unknown;
  blocked_reason:string|null;
  attempt:number;
  max_attempts:number;
  version:number;
  lease_owner:string|null;
  lease_token:string|null;
  lease_expires_at:string|null;
  created_at:string;
  updated_at:string;
};

export class SupabaseWorkSessionTaskRepository implements LeaseableWorkSessionTaskRepository {
  constructor(
    private readonly client:SupabaseClient,
    private readonly ownerUserId:string,
  ) {}

  async get(workSessionId:string,taskId:string):Promise<WorkSessionTask|null>{
    const {data,error}=await this.client.from('jhadina_work_session_tasks')
      .select('*').eq('work_session_id',workSessionId).eq('id',taskId)
      .eq('owner_user_id',this.ownerUserId).maybeSingle();
    if(error)throw new Error(`WORK_SESSION_TASK_READ_FAILED:${error.message}`);
    return data?fromRow(data as TaskRow):null;
  }

  async list(workSessionId:string):Promise<readonly WorkSessionTask[]>{
    const {data,error}=await this.client.from('jhadina_work_session_tasks')
      .select('*').eq('work_session_id',workSessionId).eq('owner_user_id',this.ownerUserId)
      .order('created_at',{ascending:true}).order('id',{ascending:true});
    if(error)throw new Error(`WORK_SESSION_TASK_LIST_FAILED:${error.message}`);
    return Object.freeze(((data??[]) as TaskRow[]).map(fromRow));
  }

  async create(task:WorkSessionTask):Promise<void>{
    this.assertOwner(task);
    const existing=await this.list(task.workSessionId);
    validateWorkSessionTaskGraph([...existing,task]);
    const {error}=await this.client.from('jhadina_work_session_tasks').insert(toRow(task));
    if(error)throw new Error(`WORK_SESSION_TASK_CREATE_FAILED:${error.message}`);
  }

  async update(task:WorkSessionTask,expectedVersion:number):Promise<void>{
    this.assertOwner(task);
    if(task.version!==expectedVersion+1)throw new Error('WORK_SESSION_TASK_VERSION_CONFLICT');
    const existing=await this.list(task.workSessionId);
    const current=existing.find(candidate=>candidate.id===task.id);
    if(!current)throw new Error('WORK_SESSION_TASK_NOT_FOUND');
    if(current.idempotencyKey!==task.idempotencyKey||current.workSessionId!==task.workSessionId||current.ownerUserId!==task.ownerUserId){
      throw new Error('WORK_SESSION_TASK_IMMUTABLE_IDENTITY');
    }
    validateWorkSessionTaskGraph(existing.map(candidate=>candidate.id===task.id?task:candidate));
    const {data,error}=await this.client.from('jhadina_work_session_tasks')
      .update(toRow(task))
      .eq('work_session_id',task.workSessionId)
      .eq('id',task.id)
      .eq('owner_user_id',this.ownerUserId)
      .eq('version',expectedVersion)
      .select('version')
      .maybeSingle();
    if(error)throw new Error(`WORK_SESSION_TASK_UPDATE_FAILED:${error.message}`);
    if(!data)throw new Error('WORK_SESSION_TASK_VERSION_CONFLICT');
  }

  async claimReady(workSessionId:string,taskId:string,workerId:string,leaseMs:number):Promise<WorkSessionTask|null>{
    const {data,error}=await this.client.rpc('jhadina_claim_work_session_task',{
      p_work_session_id:workSessionId,
      p_task_id:taskId,
      p_owner_user_id:this.ownerUserId,
      p_worker_id:workerId,
      p_lease_ms:leaseMs,
    });
    if(error)throw new Error(`WORK_SESSION_TASK_CLAIM_FAILED:${error.message}`);
    return firstRow(data);
  }

  async renewLease(workSessionId:string,taskId:string,workerId:string,leaseToken:string,leaseMs:number):Promise<WorkSessionTask|null>{
    const {data,error}=await this.client.rpc('jhadina_renew_work_session_task_lease',{
      p_work_session_id:workSessionId,
      p_task_id:taskId,
      p_owner_user_id:this.ownerUserId,
      p_worker_id:workerId,
      p_lease_token:leaseToken,
      p_lease_ms:leaseMs,
    });
    if(error)throw new Error(`WORK_SESSION_TASK_RENEW_FAILED:${error.message}`);
    return firstRow(data);
  }

  async releaseLease(
    workSessionId:string,
    taskId:string,
    workerId:string,
    leaseToken:string,
    nextStatus:WorkSessionTaskStatus,
    blockedReason?:string,
  ):Promise<WorkSessionTask|null>{
    const {data,error}=await this.client.rpc('jhadina_release_work_session_task_lease',{
      p_work_session_id:workSessionId,
      p_task_id:taskId,
      p_owner_user_id:this.ownerUserId,
      p_worker_id:workerId,
      p_lease_token:leaseToken,
      p_next_status:nextStatus,
      p_blocked_reason:blockedReason??null,
    });
    if(error)throw new Error(`WORK_SESSION_TASK_RELEASE_FAILED:${error.message}`);
    return firstRow(data);
  }

  private assertOwner(task:WorkSessionTask):void{
    if(task.ownerUserId!==this.ownerUserId)throw new Error('WORK_SESSION_TASK_OWNER_MISMATCH');
  }
}

function toRow(task:WorkSessionTask):TaskRow{
  return {
    id:task.id,
    work_session_id:task.workSessionId,
    owner_user_id:task.ownerUserId,
    parent_task_id:task.parentTaskId??null,
    domain:task.domain,
    capability:task.capability,
    status:task.status,
    authority_ref:task.authorityRef,
    idempotency_key:task.idempotencyKey,
    correlation_id:task.correlationId,
    causation_id:task.causationId??null,
    dependency_ids:[...task.dependencyIds],
    input_refs:[...task.inputRefs],
    output_refs:[...task.outputRefs],
    blocked_reason:task.blockedReason??null,
    attempt:task.attempt,
    max_attempts:task.maxAttempts,
    version:task.version,
    lease_owner:task.leaseOwner??null,
    lease_token:task.leaseToken??null,
    lease_expires_at:task.leaseExpiresAt??null,
    created_at:task.createdAt,
    updated_at:task.updatedAt,
  };
}

function fromRow(row:TaskRow):WorkSessionTask{
  return Object.freeze({
    id:row.id,
    workSessionId:row.work_session_id,
    ownerUserId:row.owner_user_id,
    parentTaskId:row.parent_task_id??undefined,
    domain:row.domain,
    capability:row.capability,
    status:row.status,
    authorityRef:row.authority_ref,
    idempotencyKey:row.idempotency_key,
    correlationId:row.correlation_id,
    causationId:row.causation_id??undefined,
    dependencyIds:Object.freeze(asStrings(row.dependency_ids)),
    inputRefs:Object.freeze(asStrings(row.input_refs)),
    outputRefs:Object.freeze(asStrings(row.output_refs)),
    blockedReason:row.blocked_reason??undefined,
    attempt:row.attempt,
    maxAttempts:row.max_attempts,
    version:row.version,
    leaseOwner:row.lease_owner??undefined,
    leaseToken:row.lease_token??undefined,
    leaseExpiresAt:row.lease_expires_at??undefined,
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  });
}

function firstRow(data:unknown):WorkSessionTask|null{
  if(!Array.isArray(data)||data.length===0)return null;
  return fromRow(data[0] as TaskRow);
}

function asStrings(value:unknown):string[]{
  return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];
}
