import type { ExecutionAttempt, ExecutionAttemptState } from './execution-attempt.js';

/**
 * Provider evidence used to resolve an ambiguous Money execution.
 * UNKNOWN must remain non-retryable until this boundary produces evidence.
 */
export type RecoveryObservation = {
  executionId: string;
  /** Canonical action/proposal hash for the execution being reconciled. */
  proposalHash: string;
  providerOperation: string;
  providerReference?: string;
  observedState: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN';
  evidence: Record<string, unknown>;
  evidenceHash: string;
  adapterId: string;
  adapterVersion: number;
  checkedAt: string;
};

export type RecoveryDisposition =
  | 'RESOLVED_SUCCEEDED'
  | 'RESOLVED_FAILED'
  | 'RETRY_SAFE'
  | 'RETRY_BLOCKED'
  | 'MANUAL_REVIEW';

export type RecoveryResult = {
  attemptId: string;
  disposition: RecoveryDisposition;
  providerReference?: string;
  observation?: RecoveryObservation;
  reason: string;
};

/**
 * Provider-specific reconciliation. Implementations must query the provider
 * using a stable logical execution identity (idempotency key/reference), not
 * a transient delivery identifier.
 */
export interface ExecutionReconciler {
  reconcile(attempt: ExecutionAttempt): Promise<RecoveryObservation>;
}

export type RecoveryResolutionState = Extract<ExecutionAttemptState, 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'RECOVERY_REQUIRED'>;

/**
 * Durable bridge to Jhadina's existing connector execution ledger and
 * reconciliation records. Money Core owns the financial semantics; the
 * shared ledger owns the cross-system execution history.
 */
export interface ExecutionRecoveryLedger {
  recordObservation(input: RecoveryObservation): Promise<void> | void;
  markAttemptResolved(input: {
    attemptId: string;
    state: RecoveryResolutionState;
    providerReference?: string;
    reason: string;
    observation: RecoveryObservation;
    leaseId?: string;
  }): Promise<void> | void;
}

export function classifyRecovery(attempt: ExecutionAttempt, observation: RecoveryObservation): RecoveryResult {
  if (attempt.state !== 'UNKNOWN' && attempt.state !== 'RECOVERY_REQUIRED') {
    return {
      attemptId: attempt.attemptId,
      disposition: 'MANUAL_REVIEW',
      observation,
      reason: `Attempt is not recoverable from state ${attempt.state}`,
    };
  }

  switch (observation.observedState) {
    case 'SUCCEEDED':
      return {
        attemptId: attempt.attemptId,
        disposition: 'RESOLVED_SUCCEEDED',
        providerReference: observation.providerReference,
        observation,
        reason: 'Provider evidence confirms the external execution succeeded.',
      };
    case 'FAILED':
      return {
        attemptId: attempt.attemptId,
        disposition: 'RESOLVED_FAILED',
        providerReference: observation.providerReference,
        observation,
        reason: 'Provider evidence confirms the external execution failed.',
      };
    case 'NOT_FOUND':
      return {
        attemptId: attempt.attemptId,
        disposition: 'RETRY_SAFE',
        observation,
        reason: 'Provider reports no matching execution; retry is permitted only through a newly authorized attempt.',
      };
    case 'PENDING':
      return {
        attemptId: attempt.attemptId,
        disposition: 'RETRY_BLOCKED',
        observation,
        reason: 'Provider reports the execution is still pending; do not create a duplicate side effect.',
      };
    case 'CONFLICT':
      return {
        attemptId: attempt.attemptId,
        disposition: 'MANUAL_REVIEW',
        observation,
        reason: 'Provider evidence conflicts with the local execution identity or expected economics.',
      };
    case 'UNKNOWN':
    default:
      return {
        attemptId: attempt.attemptId,
        disposition: 'RETRY_BLOCKED',
        observation,
        reason: 'Provider evidence is insufficient to prove that retry is safe.',
      };
  }
}
