import type { SqlExecutor } from "./postgres-adapters.js";
import { PostgresPaymentReconciliationRepository } from "./payment-reconciliation-repository.js";
import type { PaymentReconciliationStore, PaymentTransaction } from "./payment-reconciliation.js";

export class PostgresPaymentTransaction implements PaymentTransaction {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }) {}

  run<T>(work: (store: PaymentReconciliationStore) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const store = new PostgresPaymentReconciliationRepository(tx, this.ids);
      return work(store);
    });
  }
}
