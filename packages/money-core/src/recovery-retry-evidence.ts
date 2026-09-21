import type { ExecutionAttempt } from './execution-attempt.js'
import { classifyRecovery, type RecoveryObservation } from './execution-recovery.js'
import { recoveryEvidenceHash } from './postgres-execution-recovery-ledger.js'

export interface RecoveryRetryEvidenceStore {
  getLatestObservation(executionId:string):Promise<RecoveryObservation|undefined>|RecoveryObservation|undefined
}

export function assertRetrySafeRecoveryEvidence(parent:ExecutionAttempt,observation:RecoveryObservation|undefined):RecoveryObservation{
  if(!observation)throw new Error('MONEY_RECOVERY_RETRY_EVIDENCE_REQUIRED')
  if(observation.executionId!==parent.attemptId)throw new Error('MONEY_RECOVERY_RETRY_EXECUTION_MISMATCH')
  if(observation.proposalHash!==parent.actionFingerprint)throw new Error('MONEY_RECOVERY_RETRY_FINGERPRINT_MISMATCH')
  if(observation.providerOperation!==parent.operation)throw new Error('MONEY_RECOVERY_RETRY_OPERATION_MISMATCH')
  if(observation.evidenceHash!==recoveryEvidenceHash(observation))throw new Error('MONEY_RECOVERY_RETRY_EVIDENCE_HASH_MISMATCH')
  const disposition=classifyRecovery(parent,observation)
  if(disposition.disposition!=='RETRY_SAFE')throw new Error('MONEY_RECOVERY_RETRY_NOT_SAFE')
  return observation
}
