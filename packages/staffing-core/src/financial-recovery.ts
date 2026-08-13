import type { FinancialOperationRecord } from "./financial-idempotency.js";

export type FinancialRecoveryAction = "RETURN_COMPLETED" | "RETRY_FAILED" | "RECONCILE_PROCESSING" | "WAIT_PROCESSING";

export function financialRecoveryAction(operation: FinancialOperationRecord, now: string, staleAfterMs = 15 * 60 * 1000): FinancialRecoveryAction {
  if (operation.status === "COMPLETED") return "RETURN_COMPLETED";
  if (operation.status === "FAILED") return "RETRY_FAILED";
  if (operation.status === "PROCESSING") {
    const age = new Date(now).getTime() - new Date(operation.createdAt).getTime();
    return age >= staleAfterMs ? "RECONCILE_PROCESSING" : "WAIT_PROCESSING";
  }
  return "RECONCILE_PROCESSING";
}
