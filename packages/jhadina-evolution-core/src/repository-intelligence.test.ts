import { describe, expect, it } from "vitest";
import { DefaultRepositoryIntelligenceCollector } from "./repository-intelligence";

describe("RepositoryIntelligenceCollector", () => {
  it("collects a read-only evidence packet scoped to the repair", async () => {
    let called = false;
    const collector = new DefaultRepositoryIntelligenceCollector({
      async snapshot(input) {
        called = true;
        expect(input.repository).toBe("bookieandco/crispy-waddle");
        expect(input.branch).toBe("agent/jhadina-integration-spine");
        expect(input.query).toContain("repair-1");
        expect(input.allowedPaths).toEqual(["packages/jhadina-evolution-core"]);
        return {
          repository: input.repository,
          branch: input.branch,
          commit: "abc123",
          structure: ["packages/jhadina-evolution-core/src"],
          relevantFiles: ["repair-fsm.ts", "repair-orchestrator.ts"],
          recentCommits: [{ sha: "abc123", message: "test" }],
          openIssues: [],
          openPullRequests: [],
          ci: [{ name: "tests", status: "passing" }],
          documentation: ["README.md"],
        };
      },
    });

    const evidence = await collector.collect({
      repository: "bookieandco/crispy-waddle",
      branch: "agent/jhadina-integration-spine",
      query: "repair-1 failing test",
      allowedPaths: ["packages/jhadina-evolution-core"],
    });

    expect(called).toBe(true);
    expect(evidence.snapshot.relevantFiles).toHaveLength(2);
    expect(evidence.scope).toEqual(["packages/jhadina-evolution-core"]);
    expect(evidence.findings).toContain("Open issues: 0");
  });
});
