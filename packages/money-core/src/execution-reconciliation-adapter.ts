import type { ExecutionAttempt } from './execution-attempt.js';
import type { ExecutionReconciler, RecoveryObservation } from './execution-recovery.js';

/**
 * Explicit capability for resolving an ambiguous external Money execution.
 * Read-only account adapters (for example Plaid) do not satisfy this contract
 * merely because they can read balances or transactions.
 */
export interface MoneyExecutionReconciliationAdapter extends ExecutionReconciler {
  readonly provider: string;
  readonly adapterId: string;
  readonly adapterVersion: number;
  canReconcile(attempt: ExecutionAttempt): boolean;
  reconcile(attempt: ExecutionAttempt): Promise<RecoveryObservation>;
}

export class ExecutionReconciliationAdapterRegistry {
  private readonly adapters = new Map<string, MoneyExecutionReconciliationAdapter>();

  register(adapter: MoneyExecutionReconciliationAdapter): void {
    if (!adapter.provider || !adapter.adapterId || !Number.isInteger(adapter.adapterVersion) || adapter.adapterVersion < 1) {
      throw new Error('MONEY_RECONCILIATION_ADAPTER_INVALID');
    }
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`MONEY_RECONCILIATION_ADAPTER_ALREADY_REGISTERED:${adapter.provider}`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: string): MoneyExecutionReconciliationAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`MONEY_RECONCILIATION_ADAPTER_NOT_REGISTERED:${provider}`);
    return adapter;
  }

  getReconciler(provider: string, attempt: ExecutionAttempt): ExecutionReconciler {
    const adapter = this.get(provider);
    if (adapter.provider !== attempt.provider) {
      throw new Error(`MONEY_RECONCILIATION_PROVIDER_MISMATCH:${provider}`);
    }
    if (!adapter.canReconcile(attempt)) {
      throw new Error(`MONEY_RECONCILIATION_UNSUPPORTED_EXECUTION:${provider}`);
    }
    return adapter;
  }
}

export function createExecutionReconciler(
  registry: ExecutionReconciliationAdapterRegistry,
  attempt: ExecutionAttempt,
): ExecutionReconciler {
  return registry.getReconciler(attempt.provider, attempt);
}
