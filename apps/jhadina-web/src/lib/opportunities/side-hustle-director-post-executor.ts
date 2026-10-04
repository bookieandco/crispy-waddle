import type {SupabaseClient} from '@supabase/supabase-js'
import {
  claimNextReadyWorkSessionTask,
  reconcileWorkSessionTaskReadiness,
  type WorkSessionTask,
} from '@jhadina/core-spine'
import type {
  ComputeSubmissionReceipt,
  OneRuntimeComputeBinding,
} from '@jhadina/compute-core'
import {SupabaseWorkSessionTaskRepository} from '@/lib/work-session/supabase-work-session-task-repository'
import {
  ensureSideHustleDirectorPostWorkSession,
  type DirectorPostTaskDescriptor,
} from './side-hustle-director-post-work-session'

export type DirectorPostComputeDispatchInput=Readonly<{
  projectId:string
  ownerUserId:string
  task:WorkSessionTask
  descriptor:DirectorPostTaskDescriptor
}>

export interface DirectorPostComputeDispatcher{
  readonly id:string
  readonly authority:'CANONICAL_COMPUTE_SUBMISSION'
  isReady():Promise<Readonly<{ready:boolean;reasons:readonly string[]}>>
  submit(input:DirectorPostComputeDispatchInput):Promise<ComputeSubmissionReceipt>
}

export type DirectorPostExecutionStep=Readonly<{
  projectId:string
  workSessionId:string
  status:'waiting'|'submitted'|'retrying'|'blocked'|'complete'
  boundary:
    |'COMPUTE_RUNTIME_BINDING_REQUIRED'
    |'POST_TASK_READY'
    |'POST_TASK_SUBMITTED'
    |'POST_TASK_RETRY_REQUIRED'
    |'POST_TASK_BLOCKED'
    |'POST_TASK_RESULTS_REQUIRED'
    |'POST_PRODUCTION_COMPLETE'
  taskId?:string
  capability?:string
  dispatcherId?:string
  submission?:ComputeSubmissionReceipt
  reasons:readonly string[]
  authority:'DIRECTOR_POST_EXECUTION_COORDINATION'
  canApprove:false
  canPublish:false
  canSpend:false
}>

function descriptorMap(values:readonly DirectorPostTaskDescriptor[]):Map<string,DirectorPostTaskDescriptor>{
  return new Map(values.map(value=>[value.taskId,value] as const))
}

function validateReceipt(
  task:WorkSessionTask,
  receipt:ComputeSubmissionReceipt,
):void{
  if(receipt.userId!==task.ownerUserId)throw new Error('DIRECTOR_POST_EXECUTION_RECEIPT_OWNER_MISMATCH')
  if(receipt.workSessionId!==task.workSessionId)throw new Error('DIRECTOR_POST_EXECUTION_RECEIPT_SESSION_MISMATCH')
  if(receipt.taskId!==task.id)throw new Error('DIRECTOR_POST_EXECUTION_RECEIPT_TASK_MISMATCH')
  if(receipt.idempotencyKey!==task.idempotencyKey)throw new Error('DIRECTOR_POST_EXECUTION_RECEIPT_IDEMPOTENCY_MISMATCH')
  if(!receipt.submissionId.trim()||!receipt.workloadId.trim()||!receipt.manifestFingerprint.trim()){
    throw new Error('DIRECTOR_POST_EXECUTION_RECEIPT_IDENTITY_REQUIRED')
  }
}

function retryableMessage(message:string):boolean{
  return /timeout|temporar|unavailable|429|5\d\d|capacity|queue|lease|network/i.test(message)
}

export async function advanceSideHustleDirectorPostExecution(input:{
  client:SupabaseClient
  userId:string
  projectId:string
  dispatcher?:DirectorPostComputeDispatcher
  workerId?:string
  leaseMs?:number
}):Promise<DirectorPostExecutionStep>{
  const {client,userId,projectId}=input
  const prepared=await ensureSideHustleDirectorPostWorkSession({
    client,userId,projectId,allowCloudBurst:false,
  })
  const taskRepo=new SupabaseWorkSessionTaskRepository(client,userId)
  await reconcileWorkSessionTaskReadiness(taskRepo,prepared.workSessionId)
  const tasks=await taskRepo.list(prepared.workSessionId)

  if(tasks.length&&tasks.every(task=>task.status==='completed')){
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'complete',
      boundary:'POST_PRODUCTION_COMPLETE',reasons:Object.freeze([]),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  const failed=tasks.find(task=>task.status==='failed'&&task.attempt>=task.maxAttempts)
  if(failed){
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'blocked',
      boundary:'POST_TASK_BLOCKED',taskId:failed.id,capability:failed.capability,
      reasons:Object.freeze(['WORK_SESSION_TASK_MAX_ATTEMPTS_EXHAUSTED']),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  const running=tasks.find(task=>task.status==='running'&&task.leaseExpiresAt&&Date.parse(task.leaseExpiresAt)>Date.now())
  if(running){
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'waiting',
      boundary:'POST_TASK_RESULTS_REQUIRED',taskId:running.id,capability:running.capability,
      reasons:Object.freeze(['POST_TASK_ALREADY_RUNNING']),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  if(!input.dispatcher){
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'waiting',
      boundary:'COMPUTE_RUNTIME_BINDING_REQUIRED',
      reasons:Object.freeze(['CANONICAL_COMPUTE_DISPATCHER_NOT_CONFIGURED']),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }
  if(input.dispatcher.authority!=='CANONICAL_COMPUTE_SUBMISSION'){
    throw new Error('DIRECTOR_POST_EXECUTION_DISPATCHER_AUTHORITY_INVALID')
  }
  const health=await input.dispatcher.isReady()
  if(!health.ready){
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'waiting',
      boundary:'COMPUTE_RUNTIME_BINDING_REQUIRED',dispatcherId:input.dispatcher.id,
      reasons:Object.freeze([...health.reasons]),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  const workerId=input.workerId?.trim()||'director-post-autopilot'
  const leaseMs=Math.max(30_000,Math.min(15*60_000,input.leaseMs??5*60_000))
  const claimed=await claimNextReadyWorkSessionTask(taskRepo,{
    workSessionId:prepared.workSessionId,
    ownerUserId:userId,
    workerId,
    leaseMs,
    capabilityNames:prepared.descriptors.map(item=>item.capability),
  })
  if(!claimed){
    const refreshed=await taskRepo.list(prepared.workSessionId)
    const pending=refreshed.find(task=>!['completed','cancelled'].includes(task.status))
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'waiting',
      boundary:pending?'POST_TASK_READY':'POST_PRODUCTION_COMPLETE',
      ...(pending?{taskId:pending.id,capability:pending.capability}:{}),
      reasons:Object.freeze(pending?['NO_CLAIMABLE_POST_TASK']:[]),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  const descriptor=descriptorMap(prepared.descriptors).get(claimed.id)
  if(!descriptor){
    if(claimed.leaseToken){
      await taskRepo.releaseLease(
        claimed.workSessionId,claimed.id,workerId,claimed.leaseToken,'blocked',
        'DIRECTOR_POST_DESCRIPTOR_MISSING',
      )
    }
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'blocked',
      boundary:'POST_TASK_BLOCKED',taskId:claimed.id,capability:claimed.capability,
      dispatcherId:input.dispatcher.id,
      reasons:Object.freeze(['DIRECTOR_POST_DESCRIPTOR_MISSING']),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }

  try{
    const submission=await input.dispatcher.submit({
      projectId,ownerUserId:userId,task:claimed,descriptor,
    })
    validateReceipt(claimed,submission)
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:'submitted',
      boundary:'POST_TASK_SUBMITTED',taskId:claimed.id,capability:claimed.capability,
      dispatcherId:input.dispatcher.id,submission,
      reasons:Object.freeze([]),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    const retry=retryableMessage(message)&&claimed.attempt<claimed.maxAttempts
    if(claimed.leaseToken){
      await taskRepo.releaseLease(
        claimed.workSessionId,claimed.id,workerId,claimed.leaseToken,
        retry?'retrying':'blocked',
        retry?undefined:message.slice(0,500),
      )
    }
    return Object.freeze({
      projectId,workSessionId:prepared.workSessionId,status:retry?'retrying':'blocked',
      boundary:retry?'POST_TASK_RETRY_REQUIRED':'POST_TASK_BLOCKED',
      taskId:claimed.id,capability:claimed.capability,dispatcherId:input.dispatcher.id,
      reasons:Object.freeze([message]),
      authority:'DIRECTOR_POST_EXECUTION_COORDINATION',
      canApprove:false,canPublish:false,canSpend:false,
    })
  }
}

export function directorPostComputeBindingForDescriptor(
  descriptor:DirectorPostTaskDescriptor,
):OneRuntimeComputeBinding{
  return descriptor.computeBinding
}
