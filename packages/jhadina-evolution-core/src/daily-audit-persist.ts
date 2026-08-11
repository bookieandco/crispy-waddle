import { readFile } from "node:fs/promises";
import { buildDailyEvolutionCandidates, attachCandidateIds, type EvolutionCandidate } from "./daily-evolution-candidates";
import { SupabaseEvolutionCandidateRepository } from "./supabase-evolution-candidate-repository";
import type { AuditRunLedgerEvent } from "./daily-audit-ledger";

async function main() {
  const auditPath = process.argv[2];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!auditPath) throw new Error("Usage: daily-audit-persist <audit-json-path>");
  if (!url) throw new Error("SUPABASE_URL is required");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

  const audit = JSON.parse(await readFile(auditPath, "utf8")) as AuditRunLedgerEvent;
  const candidates = buildDailyEvolutionCandidates(audit);
  const repository = new SupabaseEvolutionCandidateRepository({ url, key });
  const stored: EvolutionCandidate[] = [];

  for (const candidate of candidates) {
    await repository.upsert(candidate);
    stored.push(candidate);
  }

  const updatedAudit = attachCandidateIds(audit, stored);
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(auditPath, JSON.stringify(updatedAudit, null, 2) + "\n"),
  );

  console.log(JSON.stringify({
    auditRunId: audit.runId,
    candidateCount: stored.length,
    candidateIds: stored.map((candidate) => candidate.candidateId),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
