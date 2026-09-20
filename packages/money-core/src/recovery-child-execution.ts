import type { ExecutionAttempt,ExecutionAttemptStore } from './execution-attempt.js'

export type RecoveryChildLineageInput={
  parentExecutionId:string
  child:ExecutionAttempt
}

/**
 * Mandatory pre-provider guard for any recovery child execution.
 * The caller must persist the child only after this assertion succeeds.
 */
export async function assertRecoveryChildLineage(
  attempts:ExecutionAttemptStore,
  input:RecoveryChildLineageInput,
):Promise<ExecutionAttempt>{
  const parent=await attempts.get(input.parentExecutionId)
  if(!parent)throw new Error('MONEY_RECOVERY_PARENT_NOT_FOUND')
  if(parent.state!=='RECOVERY_REQUIRED'&&!parent.recoveryRequired)throw new Error('MONEY_RECOVERY_PARENT_NOT_RECOVERABLE')
  if(input.child.recoveryOfExecutionId!==parent.attemptId)throw new Error('MONEY_RECOVERY_PARENT_LINEAGE_MISMATCH')
  if(input.child.actionFingerprint!==parent.actionFingerprint)throw new Error('MONEY_RECOVERY_ACTION_FINGERPRINT_MISMATCH')
  if(input.child.provider!==parent.provider)throw new Error('MONEY_RECOVERY_PROVIDER_MISMATCH')
  if(input.child.operation!==parent.operation)throw new Error('MONEY_RECOVERY_OPERATION_MISMATCH')
  if(input.child.requestId!==parent.requestId)throw new Error('MONEY_RECOVERY_REQUEST_MISMATCH')
  return parent
}
