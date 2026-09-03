import type { ExecutionAttemptOutcome } from './execution-attempt.js';
import type { RecoveryObservation } from './execution-recovery.js';
import type { SqlClient } from './postgres-idempotency-store.js';

export type AtomicRecoveryResolver = {
  resolve(input: {
    attemptId: string;
    proposalHash: string;
    leaseId: string;
    outcome: ExecutionAttemptOutcome;
    observation: RecoveryObservation;
    reason: string;
    completedAt?: string;
  }): Promise<void>;
};

export type PostgresAtomicRecoveryResolverOptions = { client: SqlClient };

/**
 * Final recovery state is committed by one database function so the attempt
 * and Jhadina execution ledger cannot diverge after an otherwise successful
 * reconciliation.
 */
export class PostgresAtomicRecoveryResolver implements AtomicRecoveryResolver {
  constructor(private readonly options: PostgresAtomicRecoveryResolverOptions) {}

  async resolve(input: {
    attemptId: string;
    proposalHash: string;
    leaseId: string;
    outcome: ExecutionAttemptOutcome;
    observation: RecoveryObservation;
    reason: string;
    completedAt?: string;
  }): Promise<void> {
    const result = await this.options.client.query<{ atomic_recovery_resolved: boolean }>(
      'SELECT public.resolve_money_execution_recovery_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        input.attemptId,
        input.proposalHash,
        input.leaseId,
        input.outcome.state,
        input.outcome.providerReference ?? null,
        input.outcome.errorCode ?? null,
        input.outcome.errorMessage ?? null,
        input.outcome.recoveryRequired,
        input.reason,
        JSON.stringify(input.observation),
        input.completedAt ?? input.observation.checkedAt,
      ],
    );

    if (!result.rows[0]?.atomic_recovery_resolved) {
      throw new Error('MONEY_ATOMIC_RECOVERY_NOT_RESOLVED');
    }
  }
}
