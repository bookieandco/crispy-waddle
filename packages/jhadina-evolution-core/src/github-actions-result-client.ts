import { parseEvolutionExecutionResult, type EvolutionExecutionResult } from "./evolution-result";

export interface ActionsApi {
  getRun(runId: number): Promise<{ status: string; conclusion: string | null }>;
  listArtifacts(runId: number): Promise<Array<{ id: number; name: string }>>;
  downloadArtifact(artifactId: number): Promise<Uint8Array>;
}

export interface ParsedArtifact {
  path: string;
  contents: string;
}

export class GitHubActionsResultClient {
  constructor(
    private readonly api: ActionsApi,
    private readonly pollMs = 1000,
    private readonly maxPolls = 180,
  ) {}

  async waitForResult(runId: number): Promise<EvolutionExecutionResult> {
    for (let attempt = 0; attempt < this.maxPolls; attempt += 1) {
      const run = await this.api.getRun(runId);
      if (run.status === "completed") return this.readResult(runId);
      await new Promise((resolve) => setTimeout(resolve, this.pollMs));
    }
    throw new Error(`Timed out waiting for GitHub Actions run ${runId}`);
  }

  private async readResult(runId: number): Promise<EvolutionExecutionResult> {
    const artifacts = await this.api.listArtifacts(runId);
    const artifact = artifacts.find((item) => item.name === `jhadina-evolution-result-${runId}`) ??
      artifacts.find((item) => item.name === "jhadina-evolution-result");
    if (!artifact) throw new Error(`Missing evolution result artifact for run ${runId}`);

    const bytes = await this.api.downloadArtifact(artifact.id);
    const text = new TextDecoder().decode(bytes);
    const json = extractJson(text);
    const result = parseEvolutionExecutionResult(json);
    if (result.runId !== runId) throw new Error(`Evolution result runId mismatch: expected ${runId}, got ${result.runId}`);
    return result;
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const start = trimmed.indexOf("{\n");
  const end = trimmed.lastIndexOf("\n}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 2));
  throw new Error("Evolution artifact does not contain a JSON result");
}
