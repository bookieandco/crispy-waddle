import type { DailyAuditFinding, DailyAuditReport } from "./daily-audit";
import { DailyEvolutionAudit } from "./daily-audit";
import type { BacklogAdapter, BacklogTask } from "./backlog-adapter";
import type { EvolutionCandidate, EvolutionRegistry } from "./evolution-registry";

export interface DailyEvolutionPipelineResult {
  report: DailyAuditReport;
  createdTasks: BacklogTask[];
  newCandidates: EvolutionCandidate[];
}

function candidateFromFinding(finding: DailyAuditFinding): EvolutionCandidate {
  const now = finding.observedAt;
  return {
    id: finding.id,
    title: finding.title,
    domain: finding.domain,
    description: finding.detail,
    status: finding.requiresApproval ? "RECOMMENDED" : "NEW",
    firstSeenAt: now,
    lastCheckedAt: now,
    evidence: [],
    versionsChecked: [],
    risk:
      finding.severity === "critical" ? "critical" :
      finding.severity === "high" ? "high" :
      finding.severity === "warning" ? "medium" : "low",
    requiresApproval: finding.requiresApproval,
  };
}

export class DailyEvolutionPipeline {
  constructor(
    private readonly audit: DailyEvolutionAudit,
    private readonly registry: EvolutionRegistry,
    private readonly backlog: BacklogAdapter,
  ) {}

  async run(now = new Date()): Promise<DailyEvolutionPipelineResult> {
    const report = await this.audit.run(now);
    const createdTasks: BacklogTask[] = [];
    const newCandidates: EvolutionCandidate[] = [];

    for (const finding of report.findings) {
      if (finding.severity === "healthy") continue;

      const existing = this.registry.get(finding.id);
      const candidate = existing
        ? this.registry.upsert({ ...existing, lastCheckedAt: finding.observedAt })
        : this.registry.upsert(candidateFromFinding(finding));

      if (!existing) newCandidates.push(candidate);

      // Only create a backlog task for actionable findings. Critical findings
      // remain visible to Attention Center and cannot be auto-executed.
      if (candidate.status !== "REJECTED" && candidate.status !== "ROLLED_BACK") {
        createdTasks.push(await this.backlog.createTask(candidate));
      }
    }

    return { report, createdTasks, newCandidates };
  }
}
