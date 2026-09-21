import type { ActionRequest } from '@jhadina/action-core'
import { createExecutionAttempt,type ExecutionAttempt,type ExecutionAttemptOutcome,type ExecutionAttemptStore } from './execution-attempt.js'
import { authorizeAndConsumeMoneyPermit,type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { PermitStore } from './execution-permit.js'
import { createProviderExecutionIdentityFromAttempt,type ProviderExecutionIdentity } from './provider-execution-identity.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'
import { assertRetrySafeRecoveryEvidence,type RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js'

export type RecoveryChildProviderResult={providerReference:string}
export type RecoveryChildExecutorDeps={
  attempts:ExecutionAttemptStore
  permitStore:PermitStore
  retryEvidence:RecoveryRetryEvidenceStore
  executeProvider:(child:ExecutionAttempt,identity:ProviderExecutionIdentity)=>Promise<RecoveryChildProviderResult>
}
export type RecoveryChildExecutionInput={
  parentExecutionId:string
  attemptId:string
  request:ActionRequest<unknown>
  permit:MoneyExecutionPermit
  now:string
}

function assertSame(value:unknown,expected:unknown,field:string):void{
 if((value??undefined)!==(expected??undefined))throw new Error(`MONEY_RECOVERY_AUTH_ACTION_MISMATCH:${field}`)
}
function assertRequestMatchesParent(request:ActionRequest<unknown>,parent:ExecutionAttempt):void{
 if(request.id!==parent.requestId)throw new Error('MONEY_RECOVERY_AUTH_REQUEST_MISMATCH')
 if(request.userId!==parent.actionSnapshot.userId)throw new Error('MONEY_RECOVERY_AUTH_USER_MISMATCH')
 if(request.type!==parent.operation)throw new Error('MONEY_RECOVERY_AUTH_CAPABILITY_MISMATCH')
 const action=request.action
 if(!action||typeof action!=='object')throw new Error('MONEY_RECOVERY_AUTH_ACTION_INVALID')
 const a=action as Record<string,unknown>,p=parent.actionSnapshot
 assertSame(a.provider,p.provider,'provider')
 assertSame(a.accountId,p.accountId,'accountId')
 assertSame(a.fromAccountId,p.fromAccountId,'fromAccountId')
 assertSame(a.toAccountId,p.toAccountId,'toAccountId')
 assertSame(a.payeeId,p.payeeId,'payeeId')
 assertSame(a.instrumentId,p.instrumentId,'instrumentId')
 assertSame(a.currency,p.currency,'currency')
 assertSame(a.amount==null?undefined:String(a.amount),p.amount,'amount')
}

/**
 * Governed recovery re-execution.
 *
 * The caller never supplies recovery economics. The child is reconstructed
 * from the persisted parent's immutable action snapshot, and provider I/O is
 * impossible until canonical NOT_FOUND evidence plus a fresh single-use
 * Action-Core-bound permit both verify.
 */
export class MoneyRecoveryChildExecutor{
 constructor(private readonly deps:RecoveryChildExecutorDeps){}
 async execute(input:RecoveryChildExecutionInput):Promise<RecoveryChildProviderResult>{
  const parent=await this.deps.attempts.get(input.parentExecutionId)
  if(!parent)throw new Error('MONEY_RECOVERY_PARENT_NOT_FOUND')
  if(input.permit.permitId===parent.permitId)throw new Error('MONEY_RECOVERY_FRESH_PERMIT_REQUIRED')
  assertRequestMatchesParent(input.request,parent)
  const observation=await this.deps.retryEvidence.getLatestObservation(parent.attemptId)
  assertRetrySafeRecoveryEvidence(parent,observation)
  const child=createExecutionAttempt({
   attemptId:input.attemptId,
   requestId:parent.requestId,
   permitId:input.permit.permitId,
   action:parent.actionSnapshot,
   operation:parent.operation,
   now:input.now,
   recoveryOfExecutionId:parent.attemptId,
  })
  await assertRecoveryChildLineage(this.deps.attempts,{parentExecutionId:parent.attemptId,child})
  await authorizeAndConsumeMoneyPermit(this.deps.permitStore,input.permit,input.request,child.actionSnapshot,input.now)
  await this.deps.attempts.start(child)
  const identity=createProviderExecutionIdentityFromAttempt(child)
  try{
   const result=await this.deps.executeProvider(child,identity)
   const outcome:ExecutionAttemptOutcome={state:'SUCCEEDED',providerReference:result.providerReference,recoveryRequired:false}
   await this.deps.attempts.complete(child.attemptId,outcome)
   return result
  }catch(error){
   const message=error instanceof Error?error.message:String(error)
   await this.deps.attempts.complete(child.attemptId,{state:'UNKNOWN',errorCode:'MONEY_PROVIDER_OUTCOME_UNKNOWN',errorMessage:message,recoveryRequired:true})
   throw new Error(`MONEY_EXECUTION_RECOVERY_REQUIRED:${child.attemptId}`)
  }
 }
}
