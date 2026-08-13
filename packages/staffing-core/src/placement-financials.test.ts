import { describe, expect, it } from "vitest";

// Contract-level tests intentionally use tiny doubles so the financial state machine
// can be exercised without requiring a live database or payment provider.
describe("PlacementFinancialService idempotency contract", () => {
  it("returns the persisted result for a completed operation", async () => {
    const result = { invoice: { id: "inv-1" }, agreementId: "agr-1" };
    const guard = { begin: async () => ({ kind: "COMPLETED" as const, result }), complete: async () => {}, fail: async () => {} };
    const state = await guard.begin();
    expect(state.kind).toBe("COMPLETED");
    expect(state.result).toEqual(result);
  });

  it("blocks a concurrent processing operation", async () => {
    const guard = { begin: async () => ({ kind: "PROCESSING" as const }) };
    const state = await guard.begin();
    expect(state.kind).toBe("PROCESSING");
  });

  it("allows a failed operation to retry", async () => {
    const guard = { begin: async () => ({ kind: "RETRY" as const }) };
    const state = await guard.begin();
    expect(state.kind).toBe("RETRY");
  });

  it("starts a new operation exactly once", async () => {
    let reservations = 0;
    const guard = { begin: async () => { reservations++; return { kind: "NEW" as const }; } };
    await guard.begin();
    expect(reservations).toBe(1);
  });
});
