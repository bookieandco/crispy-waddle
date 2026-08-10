import { describe, expect, it } from "vitest";
import { ClaudeCodeEvolutionAdapter } from "./claude-code-adapter";

describe("ClaudeCodeEvolutionAdapter", () => {
  const context = {
    plan: {
      id: "evo-1",
      title: "Fix memory adapter",
      risk: "low" as const,
      requiresApproval: false,
      allowedPaths: ["src/jhadina/memory.ts"],
      testCommands: ["pnpm test"],
      securityChecks: ["diff-policy"],
    },
    repository: {
      snapshot: {
        repository: "bookieandco/crispy-waddle",
        branch: "main",
        commit: "abc123",
        structure: ["src/jhadina/memory.ts"],
        relevantFiles: ["src/jhadina/memory.ts"],
        recentCommits: ["fix: memory lookup"],
        openIssues: ["#10 memory lookup regression"],
        openPullRequests: [],
        ci: ["tests: passing"],
        documentation: ["docs/memory.md"],
      },
      collectedAt: "2026-08-09T00:00:00Z",
      query: "memory",
      findings: ["Relevant file: src/jhadina/memory.ts", "CI: tests passing"],
      scope: ["src/jhadina/memory.ts"],
    },
  };

  it("requires repository evidence and passes it to the runner", async () => {
    let received: any;
    const adapter = new ClaudeCodeEvolutionAdapter({
      async run(input) {
        received = input;
        return {
          changedFiles: ["src/jhadina/memory.ts"],
          tests: [{ command: "pnpm test", passed: true }],
          securityChecks: [{ name: "diff-policy", passed: true }],
          diffSummary: "Fixed memory lookup.",
        };
      },
    });

    const evidence = await adapter.execute({
      plan: context.plan,
      workspace: { path: "/tmp/evolution", branch: "evolution/evo-1" },
      context,
    });

    expect(received.prompt).toContain("bookieandco/crispy-waddle");
    expect(received.prompt).toContain("CI: tests passing");
    expect(received.prompt).toContain("src/jhadina/memory.ts");
    expect(received.disallowedTools).toContain("Bash(git push)");
    expect(received.disallowedTools).toContain("Bash(gh)");
    expect(evidence.changedFiles).toEqual(["src/jhadina/memory.ts"]);
  });

  it("supports runners that consume the typed repair context directly", async () => {
    let received: any;
    const adapter = new ClaudeCodeEvolutionAdapter({
      async runRepair(input) {
        received = input;
        return {
          changedFiles: ["src/jhadina/memory.ts"],
          tests: [{ command: "pnpm test", passed: true }],
          securityChecks: [{ name: "diff-policy", passed: true }],
          diffSummary: "Fixed memory lookup.",
        };
      },
      async run() {
        throw new Error("run should not be called when runRepair is available");
      },
    });

    await adapter.execute({
      plan: context.plan,
      workspace: { path: "/tmp/evolution", branch: "evolution/evo-1" },
      context,
    });

    expect(received.context).toBe(context);
    expect(received.context.repository.snapshot.recentCommits).toContain("fix: memory lookup");
  });

  it("rejects plan-only execution", async () => {
    const adapter = new ClaudeCodeEvolutionAdapter({
      async run() {
        throw new Error("runner should not execute");
      },
    });

    await expect(
      adapter.execute({
        plan: context.plan,
        workspace: { path: "/tmp/evolution", branch: "evolution/evo-1" },
      }),
    ).rejects.toThrow("requires ClaudeRepairContext");
  });
});
