import { describe, expect, it } from "vitest";
import { RepairFSM } from "./repair-fsm";

describe("RepairFSM", () => {
  const fsm = () => new RepairFSM({
    maxAttempts: 3,
    requiresApproval: true,
    protectedPaths: ["/policy", "/values", "/security", "/secrets", "/payments"],
  });

  it("runs understand -> collect -> fix -> test -> verify -> approval -> completed", () => {
    const machine = fsm();
    let ctx = machine.create("repair-1");
    ctx = machine.recordDiagnosis(ctx, "A failing import breaks the test suite.");
    ctx = machine.transition(ctx, "advance", "Diagnosis recorded").context;
    ctx = machine.collect(ctx, ["test output", "stack trace"]);
    ctx = machine.transition(ctx, "advance", "Evidence collected").context;
    ctx = machine.proposeFix(ctx, "Replace the stale import", ["src/example.ts"]);
    ctx = machine.transition(ctx, "advance", "Fix proposed").context;
    ctx = machine.recordTestResult(ctx, true);
    ctx = machine.transition(ctx, "advance", "Tests passed").context;
    ctx = machine.recordVerification(ctx, true);
    expect(ctx.state).toBe("VERIFY");
    ctx = machine.transition(ctx, "advance", "Verification passed").context;
    expect(ctx.state).toBe("APPROVAL");
    ctx = machine.approve(ctx).context;
    expect(ctx.state).toBe("COMPLETED");
  });

  it("blocks protected paths", () => {
    const machine = fsm();
    let ctx = machine.create("repair-2");
    ctx = machine.transition(ctx, "advance", "Diagnosis recorded").context;
    ctx = machine.collect(ctx, ["policy failure"]);
    ctx = machine.transition(ctx, "advance", "Evidence collected").context;
    expect(() => machine.proposeFix(ctx, "Change policy", ["src/policy/rules.ts"])).toThrow();
  });

  it("fails after the retry budget is exhausted", () => {
    const machine = new RepairFSM({ maxAttempts: 1, requiresApproval: false, protectedPaths: [] });
    let ctx = machine.create("repair-3");
    ctx = machine.transition(ctx, "advance", "Diagnosis recorded").context;
    ctx = machine.collect(ctx, ["failure"]);
    ctx = machine.transition(ctx, "advance", "Evidence collected").context;
    ctx = machine.transition(ctx, "retry", "First patch failed").context;
    expect(ctx.attempt).toBe(1);
    ctx = machine.transition(ctx, "advance", "Retrying patch").context;
    ctx = machine.transition(ctx, "retry", "Second patch failed").context;
    expect(ctx.state).toBe("FAILED");
  });
});
