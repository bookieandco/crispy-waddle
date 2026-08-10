import { describe, expect, it } from "vitest";
import { GitHubActionsResultClient } from "./github-actions-result-client";

describe("GitHubActionsResultClient", () => {
  it("polls and consumes the correlated result artifact", async () => {
    let polls = 0;
    const client = new GitHubActionsResultClient({
      async getRun(runId) {
        expect(runId).toBe(42);
        polls += 1;
        return polls < 2 ? { status: "in_progress", conclusion: null } : { status: "completed", conclusion: "success" };
      },
      async listArtifacts(runId) {
        expect(runId).toBe(42);
        return [{ id: 7, name: "jhadina-evolution-result-42" }];
      },
      async downloadArtifact(id) {
        expect(id).toBe(7);
        return new TextEncoder().encode(JSON.stringify({
          version: "1",
          taskId: "evo-42",
          runId: 42,
          status: "VERIFIED",
          baseBranch: "main",
          branch: "jhadina/evolution/evo-42",
          changedFiles: ["src/fix.ts"],
          diffStat: "1 file changed",
          verification: { protectedPaths: "success", evolutionCoreTests: "success" },
          draftPr: "https://github.com/bookieandco/crispy-waddle/pull/42",
        }));
      },
    }, 0, 3);

    const result = await client.waitForResult(42);
    expect(result.status).toBe("VERIFIED");
    expect(result.runId).toBe(42);
  });

  it("rejects a mismatched result run id", async () => {
    const client = new GitHubActionsResultClient({
      async getRun() { return { status: "completed", conclusion: "success" }; },
      async listArtifacts() { return [{ id: 7, name: "jhadina-evolution-result-42" }]; },
      async downloadArtifact() {
        return new TextEncoder().encode(JSON.stringify({
          version: "1", taskId: "evo-99", runId: 99, status: "VERIFIED",
          baseBranch: "main", branch: "jhadina/evolution/evo-99", changedFiles: [], diffStat: "",
          verification: { protectedPaths: "success", evolutionCoreTests: "success" }, draftPr: null,
        }));
      },
    });
    await expect(client.waitForResult(42)).rejects.toThrow("runId mismatch");
  });
});
