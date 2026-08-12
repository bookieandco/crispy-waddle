import { describe, expect, it } from "vitest";
import { parseEvolutionExecutionResult } from "./evolution-result";

describe("evolution execution result", () => {
  it("parses a verified result with a draft PR", () => {
    const result = parseEvolutionExecutionResult({
      version: "1",
      taskId: "evo-1",
      runId: 42,
      status: "VERIFIED",
      baseBranch: "main",
      branch: "jhadina/evolution/evo-1-42",
      changedFiles: ["src/a.ts"],
      diffStat: "1 file changed",
      verification: { protectedPaths: "success", evolutionCoreTests: "success" },
      draftPr: "https://github.com/bookieandco/crispy-waddle/pull/42",
    });
    expect(result.status).toBe("VERIFIED");
    expect(result.draftPr).toContain("/pull/42");
  });

  it("rejects malformed or unknown results", () => {
    expect(() => parseEvolutionExecutionResult({ version: "99" })).toThrow();
    expect(() => parseEvolutionExecutionResult({ version: "1", taskId: "x", runId: 1, status: "READY" })).toThrow();
  });
});
