import { describe, expect, it } from "vitest";
import { RepairFSM } from "./repair-fsm";
import { applyWorkflowResult } from "./claude-actions-fsm-bridge";

describe("Claude Actions -> Repair FSM bridge", () => {
  const fsm = () => new RepairFSM({
    maxAttempts: 2,
    requiresApproval: true,
    protectedPaths: ["/policy", "/values", "/security", "/secrets", "/payments"],
  });

  it("moves a verified workflow through TEST and VERIFY into APPROVAL", () => {
    const machine = fsm();
    let ctx = machine.create("repair-1");
    ctx = machine.transition(ctx, "advance", "Diagnosis recorded").context;
    ctx = machine.collect(ctx, ["stack trace"]);
    ctx = machine.transition(ctx, "advance", "Evidence collected").context;
    ctx = machine.proposeFix(ctx, "Fix import", ["src/example.ts"]);
    ctx = machine.transition(ctx, "advance", "Fix proposed").context;

    ctx = applyWorkflowResult(machine, ctx, {
      runId: 101,
      taskId: "repair-1",
      outcome: "VERIFIED",
      changedFiles: ["src/example.ts"],
      tests: [{ command: "pnpm test", passed: true }],
      securityChecks: [{ name: "diff-policy", passed: true }],
      diffSummary: "Fix import",
      draftPr: { url: "https://github.com/example/pr/1", number: 1 },
    });

    expect(ctx.state).toBe("APPROVAL");
  });

  it("blocks a blocked workflow result", () => {
    const machine = fsm();
    let ctx = machine.create("repair-2");
    const result = applyWorkflowResult(machine, ctx, {
      runId: 102,
      taskId: "repair-2",
      outcome: "BLOCKED",
      changedFiles: [],
      tests: [],
      securityChecks: [],
      diffSummary: "Protected boundary touched",
    });
    expect(result.state).toBe("BLOCKED");
  });

  it("rejects results for another repair", () => {
    const machine = fsm();
    const ctx = machine.create("repair-3");
    expect(() => applyWorkflowResult(machine, ctx, {
      runId: 103,
      taskId: "other-repair",
      outcome: "VERIFIED",
      changedFiles: [],
      tests: [],
      securityChecks: [],
      diffSummary: "",
    })).toThrow("does not match repair");
  });
});
