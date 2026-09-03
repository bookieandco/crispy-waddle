import { randomUUID } from 'node:crypto';
import type { ExecutionAttemptOutcome, ExecutionAttemptStore } from './execution-attempt.js';
import { classifyRecovery, type ExecutionReconciler, type ExecutionRecoveryLedger, type RecoveryResult } from './execution-recovery.js';
import { assertRecoveryLease, type ExecutionRecoveryLeaseStore } from './execution-recovery-lease.js';
import { recoveryEvidenceHash, type PostgresExecutionRecoveryLedger } from './postgres-execution-recovery-ledger.js';
import type { AtomicRecoveryResolver } from './postgres-atomic-recovery-resolver.js';

export type ExecutionRecoveryServiceOptions = {
  attempts: ExecutionAttemptStore;
  reconciler: ExecutionReconciler;
  ledger: ExecutionRecoveryLedger & Partial<Pick<PostgresExecutionRecoveryLedger, 'ensureExecutionLedger'>>;
  atomicResolver: AtomicRecoveryResolver;
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

      const renewed = await this.deps.leases.renew(attempt.attemptId, leaseId, leaseSeconds);
      if (!renewed) throw new Error('MONEY_RECOVERY_LEASE_LOST');
      assertRecoveryLease(renewed, this.deps.now?.() ?? Date.now());

      await this.deps.ledger.recordObservation(observation);
      const result = classifyRecovery(attempt, observation);

      if (result.disposition === 'RESOLVED_SUCCEEDED' || result.disposition === 'RESOLVED_FAILED') {
        const finalLease = await this.deps.leases.renew(attempt.attemptId, leaseId, leaseSeconds);
        if (!finalLease) throw new Error('MONEY_RECOVERY_LEASE_LOST');
        assertRecoveryLease(finalLease, this.deps.now?.() ?? Date.now());

        const outcome: ExecutionAttemptOutcome = result.disposition === 'RESOLVED_SUCCEEDED'
          ? { state: 'SUCCEEDED', providerReference: observation.providerReference, recoveryRequired: false }
          : { state: 'FAILED', providerReference: observation.providerReference, errorCode: 'MONEY_PROVIDER_CONFIRMED_FAILED', errorMessage: result.reason, recoveryRequired: false };

        // One database transaction resolves both durable state machines. The
        // lease is checked again inside the transaction, so a stale worker
        // cannot resolve an execution after ownership has moved elsewhere.
        await this.deps.atomicResolver.resolve({
          attemptId: attempt.attemptId,
          proposalHash: attempt.actionFingerprint,
          leaseId,
          outcome,
          observation,
          reason: result.reason,
        });
      }

      return result;
    } finally {
      await this.deps.leases.release(attempt.attemptId, leaseId);
    }
  }
}
