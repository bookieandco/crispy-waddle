import type { ExecutionAttempt,ExecutionAttemptOutcome,ExecutionAttemptStore } from './execution-attempt.js'
import { assertRecoveryChildLineage } from './recovery-child-execution.js'

export type RecoveryChildProviderResult={providerReference:string}
export type RecoveryChildExecutorDeps={
  attempts:ExecutionAttemptStore
  executeProvider:(child:ExecutionAttempt)=>Promise<RecoveryChildProviderResult>
}

/**
 * The only Money Core primitive that should execute a recovery child.
 * Lineage is verified before the child is persisted and before provider I/O.
 */
export class MoneyRecoveryChildExecutor{
  constructor(private readonly deps:RecoveryChildExecutorDeps){}
  async execute(child:ExecutionAttempt):Promise<RecoveryChildProviderResult>{
    if(!child.recoveryOfExecutionId)throw new Error('MONEY_RECOVERY_PARENT_REQUIRED')
    await assertRecoveryChildLineage(this.deps.attempts,{parentExecutionId:child.recoveryOfExecutionId,child})
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
