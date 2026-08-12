import type {
  RepositoryIntelligenceProvider,
  RepositorySnapshot,
} from "./repository-intelligence";

export interface GitHubRepositoryClient {
  getRepository(input: { repository: string }): Promise<{ defaultBranch: string; headSha: string }>;
  getTree(input: { repository: string; branch: string }): Promise<string[]>;
  getCommits(input: { repository: string; branch: string; limit: number }): Promise<Array<{ sha: string; message: string }>>;
  getIssues(input: { repository: string; state: "open"; limit: number }): Promise<Array<{ id: string; title: string; url?: string }>>;
  getPullRequests(input: { repository: string; state: "open"; limit: number }): Promise<Array<{ id: string; title: string; url?: string }>>;
  getChecks(input: { repository: string; ref: string }): Promise<Array<{ name: string; status: "passing" | "failing" | "pending" | "unknown" }>>;
}

/**
 * Read-only GitHub-backed repository intelligence.
 *
 * The client is intentionally injected so the core package never owns a
 * GitHub credential and can be tested without network access.
 */
export class GitHubRepositoryIntelligenceProvider implements RepositoryIntelligenceProvider {
  constructor(private readonly github: GitHubRepositoryClient) {}

  async snapshot(input: {
    repository: string;
    branch: string;
    query: string;
    allowedPaths: string[];
  }): Promise<RepositorySnapshot> {
    const repo = await this.github.getRepository({ repository: input.repository });
    const branch = input.branch || repo.defaultBranch;

    const [structure, recentCommits, openIssues, openPullRequests, ci] = await Promise.all([
      this.github.getTree({ repository: input.repository, branch }),
      this.github.getCommits({ repository: input.repository, branch, limit: 10 }),
      this.github.getIssues({ repository: input.repository, state: "open", limit: 20 }),
      this.github.getPullRequests({ repository: input.repository, state: "open", limit: 20 }),
      this.github.getChecks({ repository: input.repository, ref: branch }),
    ]);

    const relevantFiles = selectRelevantFiles(structure, input.allowedPaths, input.query);
    const documentation = structure.filter((path) =>
      /(^|\/)(readme|docs|adr|architecture)(\.|\/|$)/i.test(path),
    );

    return {
      repository: input.repository,
      branch,
      commit: repo.headSha,
      structure,
      relevantFiles,
      recentCommits,
      openIssues,
      openPullRequests,
      ci,
      documentation,
    };
  }
}

function selectRelevantFiles(structure: string[], allowedPaths: string[], query: string) {
  const normalizedPaths = allowedPaths.map(normalize);
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((term) => term.length >= 3);

  return structure.filter((path) => {
    const normalized = normalize(path);
    const inScope = normalizedPaths.length === 0 || normalizedPaths.some(
      (scope) => normalized === scope || normalized.startsWith(`${scope}/`),
    );
    if (!inScope) return false;
    if (terms.length === 0) return true;
    const searchable = normalized.toLowerCase();
    return terms.some((term) => searchable.includes(term));
  });
}

function normalize(path: string) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+$/, "");
}
