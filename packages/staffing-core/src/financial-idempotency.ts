import type { ID } from "./agency-agreements.js";

export type FinancialOperationStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export interface FinancialOperationKey { organizationId: ID; idempotencyKey: string; }

export interface FinancialOperationRecord {
  organizationId: ID;
  idempotencyKey: string;
  operation: "PLACEMENT_FINANCIAL_FINALIZE";
  placementId: ID;
  timesheetId: ID;
  invoiceId: ID;
  createdAt: string;
  status: FinancialOperationStatus;
  resultJson?: unknown;
  completedAt?: string;
}

export interface FinancialIdempotencyStore {
  find(key: FinancialOperationKey): Promise<FinancialOperationRecord | null>;
  reserve(record: FinancialOperationRecord): Promise<boolean>;
  complete(key: FinancialOperationKey, result: unknown, completedAt: string): Promise<void>;
  fail(key: FinancialOperationKey, failedAt: string): Promise<void>;
  reclaimStale?(key: FinancialOperationKey, reclaimedAt: string): Promise<boolean>;
}

export type FinancialBeginResult =
  | { kind: "NEW" }
  | { kind: "COMPLETED"; result: unknown }
  | { kind: "PROCESSING" }
  | { kind: "RETRY" };

export class FinancialIdempotencyGuard {
  constructor(private readonly store: FinancialIdempotencyStore, private readonly staleAfterMs = 15 * 60 * 1000) {}

  async begin(record: FinancialOperationRecord, now = Date.now()): Promise<FinancialBeginResult> {
    const existing = await this.store.find(record);
    if (!existing) {
      const reserved = await this.store.reserve({ ...record, status: "PROCESSING" });
      if (!reserved) return { kind: "PROCESSING" };
      return { kind: "NEW" };
    }
    if (existing.status === "COMPLETED") return { kind: "COMPLETED", result: existing.resultJson };
    if (existing.status === "FAILED") return { kind: "RETRY" };
    if (existing.status === "PROCESSING") {
      const age = now - new Date(existing.createdAt).getTime();
      if (age <= this.staleAfterMs) return { kind: "PROCESSING" };
      if (this.store.reclaimStale && await this.store.reclaimStale(record, new Date(now).toISOString())) return { kind: "RETRY" };
      return { kind: "PROCESSING" };
    }
    return { kind: "PROCESSING" };
  }

  complete(key: FinancialOperationKey, result: unknown, completedAt: string) { return this.store.complete(key, result, completedAt); }
  fail(key: FinancialOperationKey, failedAt: string) { return this.store.fail(key, failedAt); }
}
