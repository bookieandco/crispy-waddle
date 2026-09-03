import type { ExecutionAttempt, ExecutionAttemptStore } from './execution-attempt.js';
import { classifyRecovery, type ExecutionReconciler, type ExecutionRecoveryLedger, type RecoveryResult } from './execution-recovery.js';
import { recoveryEvidenceHash, type PostgresExecutionRecoveryLedger } from './postgres-execution-recovery-ledger.js';

export type ExecutionRecoveryServiceOptions = {
  attempts: ExecutionAttemptStore;
  reconciler: ExecutionReconciler;
  ledger: ExecutionRecoveryLedger & Partial<Pick<PostgresExecutionRecoveryLedger, 'ensureExecutionLedger'>>;
};

export class MoneyExecutionRecoveryService {
  constructor(private readonly deps: ExecutionRecoveryServiceOptions) {}

  async recover(attemptId: string): Promise<RecoveryResult> {
    const attempt = await this.deps.attempts.get(attemptId);
    if (!attempt) throw new Error('MONEY_EXECUTION_ATTEMPT_NOT_FOUND');
    if (attempt.state !== 'UNKNOWN' && attempt.state !== 'RECOVERY_REQUIRED') {
      return classifyRecovery(attempt, {
        executionId: attempt.attemptId,
        providerOperation: attempt.operation,
        observedState: 'UNKNOWN',
        evidence: {},
        evidenceHash: recoveryEvidenceHash({ executionId: attempt.attemptId, providerOperation: attempt.operation, observedState: 'UNKNOWN', evidence: {}, adapterId: 'none', adapterVersion: 1, checkedAt: new Date().toISOString() }),
        adapterId: 'none',
        adapterVersion: 1,
        checkedAt: new Date().toISOString(),
      });
    }

    await this.deps.ledger.ensureExecutionLedger?.(attempt);
    const observation = await this.deps.reconciler.reconcile(attempt);
    await this.deps.ledger.recordObservation(observation);
    const result = classifyRecovery(attempt, observation);

    if (result.disposition === 'RESOLVED_SUCCEEDED') {
      await this.deps.attempts.resolve(attempt.attemptId, { state: 'SUCCEEDED', providerReference: observation.providerReference, recoveryRequired: false });
      await this.deps.ledger.markAttemptResolved({ attemptId: attempt.attemptId, state: 'SUCCEEDED', providerReference: observation.providerReference, reason: result.reason, observation });
    } else if (result.disposition === 'RESOLVED_FAILED') {
      await this.deps.attempts.resolve(attempt.attemptId, { state: 'FAILED', providerReference: observation.providerReference, errorCode: 'MONEY_PROVIDER_CONFIRMED_FAILED', errorMessage: result.reason, recoveryRequired: false });
      await this.deps.ledger.markAttemptResolved({ attemptId: attempt.attemptId, state: 'FAILED', providerReference: observation.providerReference, reason: result.reason, observation });
    }

    return result;
  }
}
