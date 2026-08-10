import { describe, expect, it } from "vitest";
import { ClaudeCodeEvolutionAdapter } from "./claude-code-adapter";

describe("ClaudeCodeEvolutionAdapter", () => {
  it("passes a restricted tool policy to the coding runner", async () => {
    let received: any;
    const adapter = new ClaudeCodeEvolutionAdapter({
      async run(input) {
        received = input;
        return {
          changedFiles: ["src/example.ts"],
          tests: [{ command: "pnpm test", passed: true }],
          securityChecks: [{ name: "diff-policy", passed: true }],
          diffSummary: "Small maintenance fix.",
        };
      },
    });

    const evidence = await adapter.execute({
      plan: {
        id: "evo-1",
        title: "Fix example",
        risk: "low",
        requiresApproval: false,
        allowedPaths: ["src/example.ts"],
        testCommands: ["pnpm test"],
        securityChecks: ["diff-policy"],
      },
      workspace: { path: "/tmp/evolution", branch: "evolution/evo-1" },
    });

    expect(received.allowedTools).toContain("Read");
    expect(received.disallowedTools).toContain("Bash(git push)");
    expect(received.disallowedTools).toContain("Bash(gh)");
    expect(received.maxTurns).toBe(12);
    expect(evidence.changedFiles).toEqual(["src/example.ts"]);
  });
});
