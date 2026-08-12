export interface RepositorySnapshot {
  repository: string;
  branch: string;
  commit: string;
  structure: string[];
  relevantFiles: string[];
  recentCommits: Array<{ sha: string; message: string }>;
  openIssues: Array<{ id: string; title: string; url?: string }>;
  openPullRequests: Array<{ id: string; title: string; url?: string }>;
  ci: Array<{ name: string; status: "passing" | "failing" | "pending" | "unknown" }>;
  documentation: string[];
}

export interface RepositoryIntelligenceEvidence {
  snapshot: RepositorySnapshot;
  collectedAt: string;
  query: string;
  findings: string[];
  scope: string[];
}

export interface RepositoryIntelligenceCollector {
  collect(input: {
    repository: string;
    branch: string;
    query: string;
    allowedPaths: string[];
  }): Promise<RepositoryIntelligenceEvidence>;
}

/**
 * Adapter boundary for GitHub/CLI-backed repository inspection.
 * This layer is deliberately read-only: collection cannot mutate the workspace.
 */
export class DefaultRepositoryIntelligenceCollector implements RepositoryIntelligenceCollector {
  constructor(private readonly provider: RepositoryIntelligenceProvider) {}

  async collect(input: {
    repository: string;
    branch: string;
    query: string;
    allowedPaths: string[];
  }): Promise<RepositoryIntelligenceEvidence> {
    const snapshot = await this.provider.snapshot(input);
    const findings = [
      `Repository: ${snapshot.repository}`,
      `Branch: ${snapshot.branch}`,
      `Commit: ${snapshot.commit}`,
      `Relevant files: ${snapshot.relevantFiles.length}`,
      `Open issues: ${snapshot.openIssues.length}`,
      `Open pull requests: ${snapshot.openPullRequests.length}`,
      `CI checks: ${snapshot.ci.length}`,
    ];

    return {
      snapshot,
      collectedAt: new Date().toISOString(),
      query: input.query,
      findings,
      scope: [...input.allowedPaths],
    };
  }
}

export interface RepositoryIntelligenceProvider {
  snapshot(input: {
    repository: string;
    branch: string;
    query: string;
    allowedPaths: string[];
  }): Promise<RepositorySnapshot>;
}
