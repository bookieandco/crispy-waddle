import { randomUUID } from 'node:crypto';
import type { ExecutionAttemptStore } from './execution-attempt.js';
import { classifyRecovery, type ExecutionReconciler, type ExecutionRecoveryLedger, type RecoveryResult } from './execution-recovery.js';
import { assertRecoveryLease, type ExecutionRecoveryLeaseStore } from './execution-recovery-lease.js';
import { recoveryEvidenceHash, type PostgresExecutionRecoveryLedger } from './postgres-execution-recovery-ledger.js';

export type ExecutionRecoveryServiceOptions = {
  attempts: ExecutionAttemptStore;
  reconciler: ExecutionReconciler;
  ledger: ExecutionRecoveryLedger & Partial<Pick<PostgresExecutionRecoveryLedger, 'ensureExecutionLedger'>>;
  leases: ExecutionRecoveryLeaseStore;
  leaseSeconds?: number;
  leaseIdFactory?: () => string;
  now?: () => number;
};

export class MoneyExecutionRecoveryService {
  constructor(private readonly deps: ExecutionRecoveryServiceOptions) {}

  async recover(attemptId: string): Promise<RecoveryResult> {
    const attempt = await this.deps.attempts.get(attemptId);
    if (!attempt) throw new Error('MONEY_EXECUTION_ATTEMPT_NOT_FOUND');

    if (attempt.state !== 'UNKNOWN' && attempt.state !== 'RECOVERY_REQUIRED') {
      return { attemptId: attempt.attemptId, disposition: 'MANUAL_REVIEW', reason: `Attempt is not recoverable from state ${attempt.state}` };
    }

    const leaseSeconds = this.deps.leaseSeconds ?? 60;
    const leaseId = this.deps.leaseIdFactory?.() ?? randomUUID();

    await this.deps.ledger.ensureExecutionLedger?.(attempt);
    const lease = await this.deps.leases.claim(attempt.attemptId, leaseId, leaseSeconds);
    if (!lease) throw new Error('MONEY_RECOVERY_LEASE_UNAVAILABLE');
    assertRecoveryLease(lease, this.deps.now?.() ?? Date.now());

    try {
      const observation = await this.deps.reconciler.reconcile(attempt);

      if (observation.executionId !== attempt.attemptId) throw new Error('MONEY_RECOVERY_EXECUTION_ID_MISMATCH');
      if (observation.proposalHash !== attempt.actionFingerprint) throw new Error('MONEY_RECOVERY_PROPOSAL_HASH_MISMATCH');
      const expectedEvidenceHash = recoveryEvidenceHash(observation);
      if (observation.evidenceHash !== expectedEvidenceHash) throw new Error('MONEY_RECOVERY_EVIDENCE_HASH_MISMATCH');

      // Renewal is also the ownership fence: if another worker reclaimed the
      // execution, this returns no row and this worker cannot resolve it.
      const renewed = await this.deps.leases.renew(attempt.attemptId, leaseId, leaseSeconds);
      if (!renewed) throw new Error('MONEY_RECOVERY_LEASE_LOST');
      assertRecoveryLease(renewed, this.deps.now?.() ?? Date.now());

      await this.deps.ledger.recordObservation(observation);
      const result = classifyRecovery(attempt, observation);

      if (result.disposition === 'RESOLVED_SUCCEEDED' || result.disposition === 'RESOLVED_FAILED') {
        const finalLease = await this.deps.leases.renew(attempt.attemptId, leaseId, leaseSeconds);
        if (!finalLease) throw new Error('MONEY_RECOVERY_LEASE_LOST');
        assertRecoveryLease(finalLease, this.deps.now?.() ?? Date.now());

        const outcome = result.disposition === 'RESOLVED_SUCCEEDED'
          ? { state: 'SUCCEEDED' as const, providerReference: observation.providerReference, recoveryRequired: false }
          : { state: 'FAILED' as const, providerReference: observation.providerReference, errorCode: 'MONEY_PROVIDER_CONFIRMED_FAILED', errorMessage: result.reason, recoveryRequired: false };

        await this.deps.attempts.resolve(attempt.attemptId, outcome);
        await this.deps.ledger.markAttemptResolved({
          attemptId: attempt.attemptId,
          state: outcome.state,
          providerReference: observation.providerReference,
          reason: result.reason,
          observation,
          leaseId,
        });
      }

      return result;
    } finally {
      await this.deps.leases.release(attempt.attemptId, leaseId);
    }
  }
}
