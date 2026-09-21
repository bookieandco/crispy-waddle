import type { ActionRequest } from '@jhadina/action-core'
import { createExecutionAttempt,type ExecutionAttempt,type ExecutionAttemptOutcome,type ExecutionAttemptStore } from './execution-attempt.js'
import { authorizeAndConsumeMoneyPermit,type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { PermitStore } from './execution-permit.js'
import { createProviderExecutionIdentityFromAttempt,type ProviderExecutionIdentity } from './provider-execution-identity.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'
import { assertRetrySafeRecoveryEvidence,type RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js'

export type RecoveryChildProviderResult={providerReference:string}
export type RecoveryChildExecutionInput={
  parentExecutionId:string
  attemptId:string
  request:ActionRequest<unknown>
  permit:MoneyExecutionPermit
  now:string
}
export type RecoveryChildExecutorDeps={
  attempts:ExecutionAttemptStore
  permitStore:PermitStore
  retryEvidence:RecoveryRetryEvidenceStore
  executeProvider:(child:ExecutionAttempt,identity:ProviderExecutionIdentity)=>Promise<RecoveryChildProviderResult>
}

function assertRequestMatchesParent(request:ActionRequest<unknown>,parent:ExecutionAttempt):void{
  if(request.id!==parent.requestId)throw new Error('MONEY_RECOVERY_AUTH_REQUEST_MISMATCH')
  if(request.userId!==parent.actionSnapshot.userId)throw new Error('MONEY_RECOVERY_AUTH_USER_MISMATCH')
  if(request.type!==parent.operation)throw new Error('MONEY_RECOVERY_AUTH_CAPABILITY_MISMATCH')
  if(!request.action||typeof request.action!=='object')throw new Error('MONEY_RECOVERY_AUTH_ACTION_INVALID')
  const requested=request.action as Record<string,unknown>
  const expected=parent.actionSnapshot as unknown as Record<string,unknown>
  const fields=['provider','accountId','fromAccountId','toAccountId','payeeId','instrumentId','side','executionPlanId','preflightId','approvalCandidateId','currency'] as const
  for(const field of fields){
    if(expected[field]!==undefined&&requested[field]!==expected[field])throw new Error(`MONEY_RECOVERY_AUTH_ACTION_MISMATCH:${field}`)
  }
  if(String(requested.amount)!==String(expected.amount))throw new Error('MONEY_RECOVERY_AUTH_ACTION_MISMATCH:amount')
}

export class MoneyRecoveryChildExecutor{
  constructor(private readonly deps:RecoveryChildExecutorDeps){}
  async execute(input:RecoveryChildExecutionInput):Promise<RecoveryChildProviderResult>{
    const parent=await this.deps.attempts.get(input.parentExecutionId)
    if(!parent)throw new Error('MONEY_RECOVERY_PARENT_NOT_FOUND')
    const observation=await this.deps.retryEvidence.getLatestObservation(parent.attemptId)
    assertRetrySafeRecoveryEvidence(parent,observation)
    assertRequestMatchesParent(input.request,parent)
    if(input.permit.permitId===parent.permitId)throw new Error('MONEY_RECOVERY_FRESH_PERMIT_REQUIRED')

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
    await authorizeAndConsumeMoneyPermit(this.deps.permitStore,input.permit,input.request,parent.actionSnapshot,input.now)
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
