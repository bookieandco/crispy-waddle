import { describe, expect, it } from "vitest";
import {
  InMemoryExecutionReceiptStore,
  executionReceiptId,
} from "./execution-receipt.js";

describe("execution receipts", () => {
  it("stores an immutable receipt and returns a readonly snapshot", () => {
    const store = new InMemoryExecutionReceiptStore();
    const receipt = {
      id: executionReceiptId("run-1", "proposal-1", "nonce-1"),
      proposalId: "proposal-1",
      workflowRunId: "run-1",
      approvalId: "approval-1",
      authorizationNonce: "nonce-1",
      toolId: "booking.execute",
      providerId: "dat",
      outcome: "COMPLETED" as const,
      startedAt: "2026-08-28T00:00:00.000Z",
      completedAt: "2026-08-28T00:00:01.000Z",
      outputRef: "provider-booking-1",
    };

    store.record(receipt);
    const stored = store.get(receipt.id);

    expect(stored).toEqual(receipt);
    expect(store.list()).toHaveLength(1);
    expect(Object.isFrozen(stored)).toBe(true);
  });

  it("rejects duplicate receipt ids", () => {
    const store = new InMemoryExecutionReceiptStore();
    const receipt = {
      id: executionReceiptId("run-1", "proposal-1", "nonce-1"),
      proposalId: "proposal-1",
      workflowRunId: "run-1",
      approvalId: "approval-1",
      authorizationNonce: "nonce-1",
      toolId: "booking.execute",
      outcome: "FAILED" as const,
      startedAt: "2026-08-28T00:00:00.000Z",
      completedAt: "2026-08-28T00:00:01.000Z",
      error: "provider unavailable",
    };

    store.record(receipt);
    expect(() => store.record(receipt)).toThrow("Execution receipt already exists");
  });
});
