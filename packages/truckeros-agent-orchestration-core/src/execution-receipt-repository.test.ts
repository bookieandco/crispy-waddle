import { describe, expect, it } from "vitest";
import type { ExecutionReceipt } from "./execution-receipt.js";
import {
  PersistentExecutionReceiptStore,
  type ExecutionReceiptRepository,
} from "./execution-receipt-repository.js";

const receipt: ExecutionReceipt = {
  id: "execution-receipt:run-1:proposal-1:nonce-1",
  proposalId: "proposal-1",
  workflowRunId: "run-1",
  approvalId: "approval-1",
  authorizationNonce: "nonce-1",
  toolId: "booking.execute",
  outcome: "COMPLETED",
  startedAt: "2026-08-28T00:00:00.000Z",
  completedAt: "2026-08-28T00:00:01.000Z",
  providerId: "dat",
  outputRef: "provider-booking-1",
};

describe("PersistentExecutionReceiptStore", () => {
  it("delegates writes and scoped reads to the durable repository", async () => {
    const rows = new Map<string, ExecutionReceipt>();
    const repository: ExecutionReceiptRepository = {
      async insert(value) {
        if (rows.has(value.id)) throw new Error("duplicate");
        rows.set(value.id, value);
      },
      async get(id) {
        return rows.get(id);
      },
      async listByWorkflowRun(workflowRunId) {
        return [...rows.values()].filter((row) => row.workflowRunId === workflowRunId);
      },
    };

    const store = new PersistentExecutionReceiptStore(repository);
    await store.record(receipt);

    expect(await store.get(receipt.id)).toEqual(receipt);
    expect(await store.listByWorkflowRun("run-1")).toEqual([receipt]);
    expect(await store.listByWorkflowRun("run-other")).toEqual([]);
  });

  it("does not mutate the caller's receipt object", async () => {
    let persisted: ExecutionReceipt | undefined;
    const repository: ExecutionReceiptRepository = {
      async insert(value) {
        persisted = value;
      },
      async get() {
        return persisted;
      },
      async listByWorkflowRun() {
        return persisted ? [persisted] : [];
      },
    };

    const store = new PersistentExecutionReceiptStore(repository);
    const input = { ...receipt };
    await store.record(input);

    expect(persisted).toEqual(input);
    expect(persisted).not.toBe(input);
    expect(Object.isFrozen(persisted)).toBe(true);
  });
});
