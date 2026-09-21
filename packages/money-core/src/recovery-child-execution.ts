import { fingerprintAction } from './execution-permit.js'
import type { ExecutionAttempt,ExecutionAttemptStore } from './execution-attempt.js'

export type RecoveryChildLineageInput={parentExecutionId:string;child:ExecutionAttempt}
const MAX_RECOVERY_GENERATIONS=3

async function recoveryAncestors(attempts:ExecutionAttemptStore,parent:ExecutionAttempt):Promise<ExecutionAttempt[]>{
 const ancestors=[parent];const seen=new Set<string>([parent.attemptId])
 let current=parent
 while(current.recoveryOfExecutionId){
  if(seen.has(current.recoveryOfExecutionId))throw new Error('MONEY_RECOVERY_LINEAGE_CYCLE')
  seen.add(current.recoveryOfExecutionId)
  const ancestor=await attempts.get(current.recoveryOfExecutionId)
  if(!ancestor)throw new Error('MONEY_RECOVERY_ANCESTOR_NOT_FOUND')
  ancestors.push(ancestor);current=ancestor
  if(ancestors.length>MAX_RECOVERY_GENERATIONS)throw new Error('MONEY_RECOVERY_GENERATION_LIMIT')
 }
 return ancestors
}

function assertAttemptSnapshot(attempt:ExecutionAttempt):void{
 if(fingerprintAction(attempt.actionSnapshot)!==attempt.actionFingerprint)throw new Error('MONEY_RECOVERY_ACTION_SNAPSHOT_MISMATCH')
 if(attempt.actionSnapshot.provider!==attempt.provider)throw new Error('MONEY_RECOVERY_ACTION_PROVIDER_MISMATCH')
 if(attempt.actionSnapshot.capability!==attempt.operation)throw new Error('MONEY_RECOVERY_ACTION_OPERATION_MISMATCH')
 if(attempt.actionSnapshot.actionId!==attempt.requestId)throw new Error('MONEY_RECOVERY_ACTION_REQUEST_MISMATCH')
}

/**
 * Mandatory pre-provider guard for any recovery child execution.
 * Parentage is durable state. The chain is bounded, cycle checked and every
 * persisted action snapshot must still hash to its recorded fingerprint.
 */
export async function assertRecoveryChildLineage(attempts:ExecutionAttemptStore,input:RecoveryChildLineageInput):Promise<ExecutionAttempt>{
 const parent=await attempts.get(input.parentExecutionId)
 if(!parent)throw new Error('MONEY_RECOVERY_PARENT_NOT_FOUND')
 if(parent.state!=='RECOVERY_REQUIRED'&&!parent.recoveryRequired)throw new Error('MONEY_RECOVERY_PARENT_NOT_RECOVERABLE')
 if(input.child.attemptId===parent.attemptId)throw new Error('MONEY_RECOVERY_LINEAGE_CYCLE')
 if(input.child.recoveryOfExecutionId!==parent.attemptId)throw new Error('MONEY_RECOVERY_PARENT_LINEAGE_MISMATCH')
 assertAttemptSnapshot(input.child)
 const ancestors=await recoveryAncestors(attempts,parent)
 if(ancestors.some(item=>item.attemptId===input.child.attemptId))throw new Error('MONEY_RECOVERY_LINEAGE_CYCLE')
 if(ancestors.length>MAX_RECOVERY_GENERATIONS)throw new Error('MONEY_RECOVERY_GENERATION_LIMIT')
 for(const ancestor of ancestors){
  assertAttemptSnapshot(ancestor)
  if(input.child.actionFingerprint!==ancestor.actionFingerprint)throw new Error('MONEY_RECOVERY_ACTION_FINGERPRINT_MISMATCH')
  if(input.child.provider!==ancestor.provider)throw new Error('MONEY_RECOVERY_PROVIDER_MISMATCH')
  if(input.child.operation!==ancestor.operation)throw new Error('MONEY_RECOVERY_OPERATION_MISMATCH')
  if(input.child.requestId!==ancestor.requestId)throw new Error('MONEY_RECOVERY_REQUEST_MISMATCH')
 }
 return parent
}

export { MAX_RECOVERY_GENERATIONS }
