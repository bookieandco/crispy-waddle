import { describe, expect, it } from "vitest";
import { GovernedRepairOrchestrator } from "./repair-orchestrator";
import type { CodingAgentAdapter } from "./evolution-executor";

describe("GovernedRepairOrchestrator", () => {
  const plan = {
    id: "plan-1",
    title: "Repair stale import",
    risk: "low" as const,
    requiresApproval: true,
    allowedPaths: ["packages/example/src/example.ts"],
    testCommands: ["pnpm test"],
    securityChecks: ["secret-scan"],
  };

  it("retries a failed attempt and stops at the approval boundary", async () => {
    let calls = 0;
    const agent: CodingAgentAdapter = {
      async execute() {
        calls++;
        return {
          changedFiles: ["packages/example/src/example.ts"],
          tests: [{ command: "pnpm test", passed: calls > 1 }],
          securityChecks: [{ name: "secret-scan", passed: true }],
          diffSummary: `attempt ${calls}`,
        };
      },
    };

    const result = await new GovernedRepairOrchestrator(
      { maxAttempts: 3, requiresApproval: true, protectedPaths: ["/policy", "/values", "/security", "/secrets"] },
      agent,
    ).run("repair-1", plan, { path: "/tmp/repair-1", branch: "jhadina/repair-1" });

    expect(calls).toBe(2);
    expect(result.context.state).toBe("APPROVAL");
    expect(result.context.attempt).toBe(1);
    expect(result.evidence).toHaveLength(2);
  });

  it("completes when approval is already granted", async () => {
    const agent: CodingAgentAdapter = {
      async execute() {
        return {
          changedFiles: ["packages/example/src/example.ts"],
          tests: [{ command: "pnpm test", passed: true }],
          securityChecks: [{ name: "secret-scan", passed: true }],
          diffSummary: "verified",
        };
      },
    };

    const result = await new GovernedRepairOrchestrator(
      { maxAttempts: 2, requiresApproval: true, protectedPaths: ["/policy", "/values", "/security", "/secrets"] },
      agent,
    ).run("repair-2", plan, { path: "/tmp/repair-2", branch: "jhadina/repair-2" }, true);

    expect(result.context.state).toBe("COMPLETED");
  });
});
