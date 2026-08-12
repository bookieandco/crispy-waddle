import { readFile, writeFile } from "node:fs/promises";
import { buildDailyEvolutionCandidates, attachCandidateIds } from "./daily-evolution-candidates";
import type { AuditRunLedgerEvent } from "./daily-audit-ledger";

const INGEST_URL = process.env.JHADINA_AUDIT_INGEST_URL ??
  "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-audit-ingest";

async function main() {
  const auditPath = process.argv[2];
  const githubToken = process.env.GH_TOKEN;
  if (!auditPath) throw new Error("Usage: daily-audit-persist <audit-json-path>");
  if (!githubToken) throw new Error("GH_TOKEN is required");

  const audit = JSON.parse(await readFile(auditPath, "utf8")) as AuditRunLedgerEvent;
  const candidates = buildDailyEvolutionCandidates(audit);
  const response = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      githubToken,
      repository: process.env.REPOSITORY,
      runId: Number(process.env.GITHUB_RUN_ID),
      status: audit.status,
      scheduledFor: audit.scheduledFor,
      branch: audit.branch,
      commit: audit.commit,
      auditorVersion: audit.auditorVersion,
      evidence: audit.evidence,
      candidates,
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Jhadina audit ingest failed (${response.status}): ${text}`);
  const result = JSON.parse(text) as { candidateCount?: number; hash?: string };
  const updatedAudit = attachCandidateIds(audit, candidates);
  await writeFile(auditPath, JSON.stringify(updatedAudit, null, 2) + "\n");
  console.log(JSON.stringify({
    auditRunId: audit.runId,
    candidateCount: result.candidateCount ?? candidates.length,
    candidateIds: candidates.map((candidate) => candidate.candidateId),
    ledgerHash: result.hash,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
