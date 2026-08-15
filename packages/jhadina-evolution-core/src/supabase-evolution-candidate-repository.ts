import type { EvolutionCandidateSnapshot } from "./approval-execution-gate.js";

export interface EvolutionCandidateRepository {
  getByCandidateId(candidateId: string): Promise<EvolutionCandidateSnapshot | null>;
}

type SupabaseCandidateRow = {
  candidate_id: string;
  title: string;
  suggested_change: string;
  risk: EvolutionCandidateSnapshot["risk"];
  affected_paths: unknown;
  verification_plan: unknown;
  status: string;
  proposal_hash: string;
  decided_by: string | null;
  decided_at: string | null;
  execution_id: string | null;
};

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Invalid ${field} in evolution candidate.`);
  }
  return value;
}

/**
 * Server-side adapter for the authoritative Supabase candidate record.
 * It deliberately exposes only the fields the approval gate is allowed to use.
 */
export class SupabaseEvolutionCandidateRepository implements EvolutionCandidateRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly secretKey: string,
  ) {}

  async getByCandidateId(candidateId: string): Promise<EvolutionCandidateSnapshot | null> {
    const url = new URL("/rest/v1/jhadina_evolution_candidates", this.supabaseUrl);
    url.searchParams.set("select", "candidate_id,title,suggested_change,risk,affected_paths,verification_plan,status,proposal_hash,decided_by,decided_at,execution_id");
    url.searchParams.set("candidate_id", `eq.${encodeURIComponent(candidateId)}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        apikey: this.secretKey,
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase candidate lookup failed with HTTP ${response.status}.`);
    }

    const rows = (await response.json()) as SupabaseCandidateRow[];
    const row = rows[0];
    if (!row) return null;

    return {
      candidateId: row.candidate_id,
      title: row.title,
      suggestedChange: row.suggested_change,
      risk: row.risk,
      affectedPaths: stringArray(row.affected_paths, "affected_paths"),
      verificationPlan: stringArray(row.verification_plan, "verification_plan"),
      status: row.status.toLowerCase(),
      proposalHash: row.proposal_hash,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
      executionId: row.execution_id,
    };
  }
}
