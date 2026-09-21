import type { ActionRequest } from '@jhadina/action-core'
import type { ExecutionAttempt,ExecutionAttemptOutcome,ExecutionAttemptStore } from './execution-attempt.js'
import { authorizeAndConsumeMoneyPermit,type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { PermitStore } from './execution-permit.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'
import { assertRetrySafeRecoveryEvidence,type RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js'

export type RecoveryChildProviderResult={providerReference:string}
export type RecoveryChildExecutorDeps={
  attempts:ExecutionAttemptStore
  permitStore:PermitStore
  retryEvidence:RecoveryRetryEvidenceStore
  executeProvider:(child:ExecutionAttempt)=>Promise<RecoveryChildProviderResult>
  now?:()=>string
}
export type RecoveryChildExecutionInput={
  child:ExecutionAttempt
  request:ActionRequest<unknown>
  permit:MoneyExecutionPermit
}

/**
 * The only Money Core primitive that should execute a recovery child.
 *
 * Provider I/O is impossible until all three independent proofs hold:
 * 1. canonical reconciliation evidence says the parent is RETRY_SAFE;
 * 2. the child preserves the complete immutable parent lineage;
 * 3. a fresh, exact, single-use Action-Core-bound Money permit verifies and
 *    is consumed for the child's immutable action snapshot.
 */
export class MoneyRecoveryChildExecutor{
  constructor(private readonly deps:RecoveryChildExecutorDeps){}
  async execute(input:RecoveryChildExecutionInput):Promise<RecoveryChildProviderResult>{
    const {child,request,permit}=input
    if(!child.recoveryOfExecutionId)throw new Error('MONEY_RECOVERY_PARENT_REQUIRED')
    const parent=await assertRecoveryChildLineage(this.deps.attempts,{parentExecutionId:child.recoveryOfExecutionId,child})
    const observation=await this.deps.retryEvidence.getLatestObservation(parent.attemptId)
    assertRetrySafeRecoveryEvidence(parent,observation)
    if(permit.permitId!==child.permitId)throw new Error('MONEY_RECOVERY_PERMIT_ID_MISMATCH')
    await authorizeAndConsumeMoneyPermit(
      this.deps.permitStore,
      permit,
      request,
      child.actionSnapshot,
      this.deps.now?.()??new Date().toISOString(),
    )
    await this.deps.attempts.start(child)
    try{
      const result=await this.deps.executeProvider(child)
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
