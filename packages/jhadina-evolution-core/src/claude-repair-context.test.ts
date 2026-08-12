import { describe, expect, it } from "vitest";
import { buildClaudeRepairContext, renderClaudeRepairPrompt } from "./claude-repair-context";

describe("Claude repair context", () => {
  it("keeps Claude's scope bound to the approved paths", () => {
    const context = buildClaudeRepairContext(
      {
        id: "evo-1",
        title: "Fix memory adapter",
        risk: "low",
        requiresApproval: false,
        allowedPaths: ["packages/jhadina"],
        testCommands: ["pnpm test"],
        securityChecks: ["diff-policy"],
      },
      {
        snapshot: {
          repository: "bookieandco/crispy-waddle",
          branch: "main",
          commit: "abc123",
          structure: ["packages/jhadina/a.ts", "secret.txt"],
          relevantFiles: ["packages/jhadina/a.ts", "secret.txt"],
          recentCommits: [],
          openIssues: [],
          openPullRequests: [],
          ci: [],
          documentation: [],
        },
        collectedAt: "2026-08-09T00:00:00Z",
        query: "memory",
        findings: ["Relevant files: 2"],
        scope: ["packages/jhadina"],
      },
    );

    expect(context.plan.allowedPaths).toEqual(["packages/jhadina/a.ts"]);
    expect(context.plan.allowedPaths).not.toContain("secret.txt");
  });

  it("renders repository evidence and policy boundaries into the prompt", () => {
    const context = buildClaudeRepairContext(
      {
        id: "evo-2",
        title: "Fix adapter",
        risk: "medium",
        requiresApproval: true,
        allowedPaths: ["src"],
        testCommands: ["pnpm test"],
        securityChecks: ["secrets-scan"],
      },
      {
        snapshot: {
          repository: "bookieandco/crispy-waddle",
          branch: "main",
          commit: "abc123",
          structure: [],
          relevantFiles: ["src/adapter.ts"],
          recentCommits: [],
          openIssues: [],
          openPullRequests: [],
          ci: [],
          documentation: [],
        },
        collectedAt: "2026-08-09T00:00:00Z",
        query: "adapter",
        findings: ["CI checks: 1"],
        scope: ["src"],
      },
    );

    const prompt = renderClaudeRepairPrompt(context);
    expect(prompt).toContain("bookieandco/crispy-waddle");
    expect(prompt).toContain("CI checks: 1");
    expect(prompt).toContain("Do not commit, push, deploy, access secrets");
    expect(prompt).toContain("src/adapter.ts");
  });
});
