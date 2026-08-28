import { describe, expect, it, vi } from "vitest";
import { createExecutionReceipt, persistExecutionReceipt } from "./execution-receipt.js";

describe("execution receipts", () => {
  const base = {
    bookingPackageId: "bp-1", offerId: "offer-1", proposalId: "proposal-1", approvalId: "approval-1",
    workflowRunId: "run-1", authorizationNonce: "nonce-1", provider: "DAT",
    providerBookingId: "dat-1", status: "SUCCEEDED" as const,
    startedAt: "2026-08-28T02:00:00Z", completedAt: "2026-08-28T02:00:05Z",
  };

  it("creates a correlated immutable-shaped receipt", () => {
    const receipt = createExecutionReceipt(base, () => "receipt-1");
    expect(receipt).toEqual({ receiptId: "receipt-1", ...base });
  });

  it("requires provider booking identity on success", () => {
    expect(() => createExecutionReceipt({ ...base, providerBookingId: undefined })).toThrow("providerBookingId");
  });

  it("rejects invalid chronology and missing correlation identifiers", () => {
    expect(() => createExecutionReceipt({ ...base, completedAt: "2026-08-28T01:59:00Z" })).toThrow("completedAt");
    expect(() => createExecutionReceipt({ ...base, approvalId: "" })).toThrow("identifiers");
  });

  it("persists only validated receipts", async () => {
    const write = vi.fn(async () => undefined);
    const receipt = await persistExecutionReceipt({ write }, base, () => "receipt-2");
    expect(write).toHaveBeenCalledWith(receipt);
    expect(receipt.receiptId).toBe("receipt-2");
  });
});
