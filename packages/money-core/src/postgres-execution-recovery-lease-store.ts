import type { SqlClient } from './postgres-idempotency-store.js';
import { assertLeaseSeconds, type ExecutionRecoveryLeaseStore, type RecoveryLease } from './execution-recovery-lease.js';

export type PostgresExecutionRecoveryLeaseStoreOptions = {
  client: SqlClient;
};

type LeaseRow = {
  execution_id: string;
  lease_id: string;
  lease_expires_at: string;
  state: 'recovery_required';
};

function mapLease(row: LeaseRow | undefined): RecoveryLease | undefined {
  if (!row) return undefined;
  return {
    executionId: row.execution_id,
    leaseId: row.lease_id,
    leaseExpiresAt: row.lease_expires_at,
    state: row.state,
  };
}

export class PostgresExecutionRecoveryLeaseStore implements ExecutionRecoveryLeaseStore {
  constructor(private readonly client: SqlClient) {}

  async claim(executionId: string, leaseId: string, leaseSeconds: number): Promise<RecoveryLease | undefined> {
    assertLeaseSeconds(leaseSeconds);
    const result = await this.client.query<LeaseRow>(
      'SELECT * FROM public.claim_money_execution_recovery_lease($1,$2,$3)',
      [executionId, leaseId, leaseSeconds],
    );
    return mapLease(result.rows[0]);
  }

  async renew(executionId: string, leaseId: string, leaseSeconds: number): Promise<RecoveryLease | undefined> {
    assertLeaseSeconds(leaseSeconds);
    const result = await this.client.query<LeaseRow>(
      'SELECT * FROM public.renew_money_execution_recovery_lease($1,$2,$3)',
      [executionId, leaseId, leaseSeconds],
    );
    return mapLease(result.rows[0]);
  }

  async release(executionId: string, leaseId: string): Promise<boolean> {
    const result = await this.client.query<{ release_money_execution_recovery_lease: boolean }>(
      'SELECT public.release_money_execution_recovery_lease($1,$2) AS release_money_execution_recovery_lease',
      [executionId, leaseId],
    );
    return result.rows[0]?.release_money_execution_recovery_lease === true;
  }
}
