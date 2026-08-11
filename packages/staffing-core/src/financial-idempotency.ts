import type { ID } from "./agency-agreements.js";

export interface FinancialOperationKey {
  organizationId: ID;
  idempotencyKey: string;
}

export interface FinancialOperationRecord {
  organizationId: ID;
  idempotencyKey: string;
  operation: "PLACEMENT_FINANCIAL_FINALIZE";
  invoiceId: ID;
  createdAt: string;
}

export interface FinancialIdempotencyStore {
  find(key: FinancialOperationKey): Promise<FinancialOperationRecord | null>;
  reserve(record: FinancialOperationRecord): Promise<boolean>;
}

/**
 * Database-backed guard for financial finalization.
 * The store's unique key is the authoritative exactly-once boundary.
 * A caller that loses a race must read the winner rather than execute again.
 */
export class FinancialIdempotencyGuard {
  constructor(private readonly store: FinancialIdempotencyStore) {}

  async begin(record: FinancialOperationRecord): Promise<FinancialOperationRecord | null> {
    const existing = await this.store.find(record);
    if (existing) return existing;

    const reserved = await this.store.reserve(record);
    if (!reserved) {
      const winner = await this.store.find(record);
      if (!winner) throw new Error("Financial operation reservation lost without a durable winner");
      return winner;
    }

    return null;
  }
}
