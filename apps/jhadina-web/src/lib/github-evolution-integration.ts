import type { ClaudeWorkflowExecutionResult, WorkflowDispatchClient, WorkflowResultClient } from "@jhadina/evolution-core/claude-github-actions-runner";
import type { RepositoryIntelligenceProvider, RepositorySnapshot } from "@jhadina/evolution-core/repository-intelligence";

const API = "https://api.github.com";

type GitHubOptions = { token: string; repository: string; fetchImpl?: typeof fetch };

export class GitHubEvolutionIntegration {
  readonly intelligence: RepositoryIntelligenceProvider;
  readonly dispatch: WorkflowDispatchClient;
  readonly results: WorkflowResultClient;

  constructor(private readonly options: GitHubOptions) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetchImpl(`${API}${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${options.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`GitHub API ${response.status}: ${text}`);
      return text ? (JSON.parse(text) as T) : (undefined as T);
    };

    this.intelligence = new GitHubRepositoryIntelligenceProvider(request, options.repository);
    this.dispatch = new GitHubWorkflowDispatchClient(request, options.repository);
    this.results = new GitHubWorkflowResultClient(request, options.repository);
  }
}

class GitHubRepositoryIntelligenceProvider implements RepositoryIntelligenceProvider {
  constructor(private readonly request: <T>(path: string, init?: RequestInit) => Promise<T>, private readonly repository: string) {}

  async snapshot(input: { repository: string; branch: string; query: string; allowedPaths: string[] }): Promise<RepositorySnapshot> {
    const branch = encodeURIComponent(input.branch);
    const repo = encodeURIComponent(this.repository);
    const ref = await this.request<{ object: { sha: string } }>(`/repos/${repo}/git/ref/heads/${branch}`);
    const tree = await this.request<{ tree: Array<{ path?: string; type?: string }> }>(`/repos/${repo}/git/trees/${ref.object.sha}?recursive=1`);
    const paths = tree.tree.map((entry) => entry.path).filter((path): path is string => Boolean(path));
    const relevantFiles = input.allowedPaths.length
      ? paths.filter((path) => input.allowedPaths.some((allowed) => path.startsWith(allowed.replace(/^\//, ""))))
      : paths.filter((path) => input.query.split(/\s+/).some((term) => term.length > 2 && path.toLowerCase().includes(term.toLowerCase())));

    const commits = await this.request<Array<{ sha: string; commit: { message: string } }>>(`/repos/${repo}/commits?sha=${branch}&per_page=10`);
    const issues = await this.request<Array<{ number: number; title: string; html_url: string }>>(`/repos/${repo}/issues?state=open&per_page=20`);
    const prs = await this.request<Array<{ number: number; title: string; html_url: string }>>(`/repos/${repo}/pulls?state=open&per_page=20`);
    const runs = await this.request<{ workflow_runs: Array<{ name?: string; status?: string; conclusion?: string }> }>(`/repos/${repo}/actions/runs?branch=${branch}&per_page=20`);

    return {
      repository: this.repository,
      branch: input.branch,
      commit: ref.object.sha,
      structure: paths.slice(0, 5000),
      relevantFiles: relevantFiles.slice(0, 500),
      recentCommits: commits.map((item) => ({ sha: item.sha, message: item.commit.message.split("\n")[0] })),
      openIssues: issues.map((item) => ({ id: String(item.number), title: item.title, url: item.html_url })),
      openPullRequests: prs.map((item) => ({ id: String(item.number), title: item.title, url: item.html_url })),
      ci: runs.workflow_runs.slice(0, 20).map((run) => ({
        name: run.name ?? "GitHub Actions",
        status: run.status === "completed" ? (run.conclusion === "success" ? "passing" : "failing") : run.status === "in_progress" ? "pending" : "unknown",
      })),
      documentation: paths.filter((path) => /(^|\/)(README|docs?\/)/i.test(path)).slice(0, 200),
    };
  }
}

class GitHubWorkflowDispatchClient implements WorkflowDispatchClient {
  constructor(private readonly request: <T>(path: string, init?: RequestInit) => Promise<T>, private readonly repository: string) {}

  async dispatch(input: { workflow: string; ref: string; inputs: Record<string, string> }): Promise<{ runId: number }> {
    const repo = encodeURIComponent(this.repository);
    await this.request<undefined>(`/repos/${repo}/actions/workflows/${encodeURIComponent(input.workflow)}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: input.ref, inputs: input.inputs }),
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const runs = await this.request<{ workflow_runs: Array<{ id: number; head_branch?: string; created_at: string }> }>(
        `/repos/${repo}/actions/workflows/${encodeURIComponent(input.workflow)}/runs?branch=${encodeURIComponent(input.ref)}&event=workflow_dispatch&per_page=10`,
      );
      const run = runs.workflow_runs[0];
      if (run) return { runId: run.id };
      await delay(1000);
    }
    throw new Error("GitHub workflow dispatch succeeded but no workflow run became visible");
  }
}

class GitHubWorkflowResultClient implements WorkflowResultClient {
  constructor(private readonly request: <T>(path: string, init?: RequestInit) => Promise<T>, private readonly repository: string) {}

  async waitForResult(runId: number): Promise<ClaudeWorkflowExecutionResult> {
    const repo = encodeURIComponent(this.repository);
    const run = await this.request<{ head_branch?: string; workflow_id?: number }>(`/repos/${repo}/actions/runs/${runId}`);
    if (!run.head_branch) throw new Error(`Workflow ${runId} has no head branch`);

    const taskId = decodeURIComponent(run.head_branch.replace(/^jhadina\/evolution\//, "").replace(/-\d+$/, ""));
    const path = `.jhadina/results/${taskId}.json`;

    for (let attempt = 0; attempt < 150; attempt += 1) {
      try {
        const file = await this.request<{ content: string }>(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(run.head_branch)}`);
        const result = JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) as ClaudeWorkflowExecutionResult;
        if (result.runId !== runId) throw new Error(`Result run ${result.runId} does not match workflow ${runId}`);
        return result;
      } catch (error) {
        if (attempt === 149) throw error;
        await delay(2000);
      }
    }
    throw new Error(`Timed out waiting for workflow result ${runId}`);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
