export type RecoveryLease = {
  executionId: string;
  leaseId: string;
  leaseExpiresAt: string;
  state: 'recovery_required';
};

export interface ExecutionRecoveryLeaseStore {
  claim(executionId: string, leaseId: string, leaseSeconds: number): Promise<RecoveryLease | undefined>;
  renew(executionId: string, leaseId: string, leaseSeconds: number): Promise<RecoveryLease | undefined>;
  release(executionId: string, leaseId: string): Promise<boolean>;
}

export function assertRecoveryLease(lease: RecoveryLease, now = Date.now()): void {
  if (lease.state !== 'recovery_required') {
    throw new Error('MONEY_RECOVERY_LEASE_STATE_INVALID');
  }
  if (Date.parse(lease.leaseExpiresAt) <= now) {
    throw new Error('MONEY_RECOVERY_LEASE_EXPIRED');
  }
}

export function assertLeaseSeconds(leaseSeconds: number): void {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
    throw new Error('MONEY_RECOVERY_LEASE_DURATION_INVALID');
  }
}
