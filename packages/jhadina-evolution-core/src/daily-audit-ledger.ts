import { createHash } from "node:crypto";

export const AUDIT_LEDGER_SCHEMA_VERSION = "1.0";

export type AuditRunStatus = "STARTED" | "COMPLETED" | "FAILED";

export interface AuditEvidence {
  source: string;
  command: string;
  exitCode: number;
  outputSha256: string;
  output: string;
}

export interface AuditRunLedgerEvent {
  schemaVersion: typeof AUDIT_LEDGER_SCHEMA_VERSION;
  eventType: "DAILY_AUDIT_RUN";
  runId: string;
  scheduledFor: string;
  startedAt: string;
  completedAt?: string;
  status: AuditRunStatus;
  repository: string;
  branch: string;
  commit: string;
  auditorVersion: string;
  evidence: AuditEvidence[];
  candidateIds: string[];
  previousEventHash: string | null;
  eventHash: string;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildAuditRunEvent(input: Omit<AuditRunLedgerEvent, "schemaVersion" | "eventType" | "eventHash">): AuditRunLedgerEvent {
  const base = {
    schemaVersion: AUDIT_LEDGER_SCHEMA_VERSION,
    eventType: "DAILY_AUDIT_RUN" as const,
    ...input,
  };
  const eventHash = sha256(JSON.stringify(base));
  return { ...base, eventHash };
}

export function verifyAuditRunEvent(event: AuditRunLedgerEvent): boolean {
  const { eventHash, ...base } = event;
  return sha256(JSON.stringify(base)) === eventHash;
}

export function buildEvidence(source: string, command: string, exitCode: number, output: string): AuditEvidence {
  return {
    source,
    command,
    exitCode,
    outputSha256: sha256(output),
    output,
  };
}
