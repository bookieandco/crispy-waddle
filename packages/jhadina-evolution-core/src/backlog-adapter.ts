import type { EvolutionCandidate } from "./evolution-registry";

export interface BacklogTask {
  id: string;
  title: string;
  status: "draft" | "ready";
  body: string;
}

export interface BacklogAdapter {
  createTask(candidate: EvolutionCandidate): Promise<BacklogTask>;
}

export class MarkdownBacklogAdapter implements BacklogAdapter {
  constructor(private readonly backlogDirectory = "backlog") {}

  async createTask(candidate: EvolutionCandidate): Promise<BacklogTask> {
    const id = `evolution-${candidate.id}`;
    const status = candidate.requiresApproval ? "draft" : "ready";
    const evidence = candidate.evidence
      .map((item) => `- ${item.source}: ${item.reference} — ${item.summary}`)
      .join("\n");

    const body = [
      `# ${candidate.title}`,
      "",
      `Domain: ${candidate.domain}`,
      `Risk: ${candidate.risk}`,
      `Approval required: ${candidate.requiresApproval ? "yes" : "no"}`,
      "",
      "## Problem",
      candidate.description,
      "",
      "## Evidence",
      evidence || "No evidence recorded yet.",
      "",
      "## Versions checked",
      candidate.versionsChecked.length ? candidate.versionsChecked.map((v) => `- ${v}`).join("\n") : "- None",
      "",
      "## Acceptance criteria",
      "- Change is isolated and reviewable.",
      "- Existing tests remain passing.",
      "- Security and policy checks pass.",
      "- No secrets are committed.",
      "- Required user approval is recorded before execution.",
      "",
      "## Execution",
      status === "draft" ? "Blocked pending Jhadina approval." : "Eligible for governed execution.",
      "",
      `Backlog directory: ${this.backlogDirectory}`,
    ].join("\n");

    return { id, title: candidate.title, status, body };
  }
}
