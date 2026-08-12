import { buildAuditRunEvent, buildEvidence, type AuditRunLedgerEvent } from "./daily-audit-ledger";

export interface AuditCommandResult {
  exitCode: number;
  output: string;
}

export interface AuditCommandExecutor {
  run(command: string): Promise<AuditCommandResult>;
}

export interface DailyAuditRunInput {
  repository: string;
  branch: string;
  commit: string;
  scheduledFor: string;
  auditorVersion: string;
  runId: string;
}

export interface DailyAuditOutput {
  event: AuditRunLedgerEvent;
  candidateIds: string[];
}

export const READ_ONLY_AUDIT_COMMANDS = [
  ["git", "status --short --branch"],
  ["git", "log -20 --oneline --decorate"],
  ["git", "diff --stat HEAD~1..HEAD"],
  ["pnpm", "outdated --format json"],
  ["pnpm", "audit --json"],
  ["gh", "pr list --state open --limit 50 --json number,title,headRefName,baseRefName,statusCheckRollup"],
  ["gh", "issue list --state open --limit 50 --json number,title,labels,updatedAt"],
] as const;

/**
 * Deterministic audit runner. It only executes read-only inspection commands
 * and emits a tamper-evident ledger event. It has no repair authority.
 */
export class DailyAuditScheduler {
  private running = false;

  constructor(private readonly executor: AuditCommandExecutor) {}

  async run(input: DailyAuditRunInput): Promise<DailyAuditOutput> {
    if (this.running) throw new Error("daily audit already running");
    this.running = true;
    const startedAt = new Date().toISOString();
    const evidence = [];
    const candidateIds: string[] = [];
    let status: "COMPLETED" | "FAILED" = "COMPLETED";

    try {
      for (const [source, command] of READ_ONLY_AUDIT_COMMANDS) {
        const fullCommand = `${source} ${command}`;
        const result = await this.executor.run(fullCommand);
        evidence.push(buildEvidence(source, fullCommand, result.exitCode, result.output));
        if (result.exitCode !== 0 && source !== "pnpm") status = "FAILED";
      }

      const event = buildAuditRunEvent({
        runId: input.runId,
        scheduledFor: input.scheduledFor,
        startedAt,
        completedAt: new Date().toISOString(),
        status,
        repository: input.repository,
        branch: input.branch,
        commit: input.commit,
        auditorVersion: input.auditorVersion,
        evidence,
        candidateIds,
        previousEventHash: null,
      });

      return { event, candidateIds };
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}

export function isDailyAuditDue(lastCompletedAt: string | null, now = new Date()): boolean {
  if (!lastCompletedAt) return true;
  return now.getTime() - new Date(lastCompletedAt).getTime() >= 24 * 60 * 60 * 1000;
}
