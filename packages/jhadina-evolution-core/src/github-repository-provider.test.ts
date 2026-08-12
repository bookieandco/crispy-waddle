import { describe, expect, it } from "vitest";
import { GitHubRepositoryIntelligenceProvider, type GitHubRepositoryClient } from "./github-repository-provider";

describe("GitHubRepositoryIntelligenceProvider", () => {
  it("collects a read-only, scope-bound repository snapshot", async () => {
    const client: GitHubRepositoryClient = {
      async getRepository() { return { defaultBranch: "main", headSha: "abc123" }; },
      async getTree() { return ["src/jhadina.ts", "src/other.ts", "docs/README.md", ".github/workflows/ci.yml"]; },
      async getCommits() { return [{ sha: "abc123", message: "latest" }]; },
      async getIssues() { return [{ id: "1", title: "Fix audit" }]; },
      async getPullRequests() { return [{ id: "2", title: "Improve memory" }]; },
      async getChecks() { return [{ name: "CI", status: "passing" }]; },
    };

    const provider = new GitHubRepositoryIntelligenceProvider(client);
    const snapshot = await provider.snapshot({
      repository: "bookieandco/crispy-waddle",
      branch: "main",
      query: "jhadina",
      allowedPaths: ["src"],
    });

    expect(snapshot.commit).toBe("abc123");
    expect(snapshot.relevantFiles).toEqual(["src/jhadina.ts"]);
    expect(snapshot.documentation).toEqual(["docs/README.md"]);
    expect(snapshot.ci[0]).toEqual({ name: "CI", status: "passing" });
  });
});
