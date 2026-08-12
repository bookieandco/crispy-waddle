import { describe, expect, it } from "vitest";
import { RepairCollectionStage } from "./repair-collection";

describe("RepairCollectionStage", () => {
  it("binds repository evidence to the exact repair scope", async () => {
    const stage = new RepairCollectionStage({
      async collect(input) {
        return {
          collectedAt: "2026-08-10T00:00:00.000Z",
          query: input.query,
          scope: input.allowedPaths,
          findings: ["CI failing"],
          snapshot: {
            repository: input.repository,
            branch: input.branch,
            commit: "abc123",
            structure: ["src"],
            relevantFiles: ["src/example.ts"],
            recentCommits: [],
            openIssues: [],
            openPullRequests: [],
            ci: [{ name: "test", status: "failing" }],
            documentation: ["README.md"],
          },
        };
      },
    });

    const result = await stage.collect("bookieandco/crispy-waddle", "main", {
      id: "evo-1",
      title: "Fix failing test",
      risk: "low",
      requiresApproval: true,
      allowedPaths: ["src/example.ts"],
      testCommands: ["pnpm test"],
      securityChecks: ["diff-policy"],
    });

    expect(result.evidence.scope).toEqual(["src/example.ts"]);
    expect(result.evidence.snapshot.commit).toBe("abc123");
    expect(result.promptContext).toContain("src/example.ts");
  });
});
