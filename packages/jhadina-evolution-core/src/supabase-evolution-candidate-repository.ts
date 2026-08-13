import type {
  CandidateDecision,
  EvolutionCandidateRepository,
  StoredEvolutionCandidate,
} from "./evolution-candidate-repository";
import type { EvolutionCandidate } from "./daily-evolution-candidates";

export interface SupabaseEvolutionCandidateRepositoryOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}

/** Server-side adapter for the Approval Center candidate queue. */
export class SupabaseEvolutionCandidateRepository implements EvolutionCandidateRepository {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseEvolutionCandidateRepositoryOptions) {
    this.baseUrl = options.url.replace(/\/$/, "");
    this.key = options.key;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async upsert(candidate: EvolutionCandidate): Promise<StoredEvolutionCandidate> {
    const existing = await this.get(candidate.candidateId);
    const row = toRow(candidate, existing);
    const rows = await this.request<SupabaseCandidateRow[]>("POST", "/rest/v1/jhadina_evolution_candidates?on_conflict=candidate_id", row, {
      Prefer: "resolution=merge-duplicates,return=representation",
    });
    return fromRow(rows[0]);
  }

  async get(candidateId: string): Promise<StoredEvolutionCandidate | undefined> {
    const rows = await this.request<SupabaseCandidateRow[]>(
      "GET",
      `/rest/v1/jhadina_evolution_candidates?candidate_id=eq.${encodeURIComponent(candidateId)}&limit=1`,
    );
    return rows[0] ? fromRow(rows[0]) : undefined;
  }

  async listPending(limit = 50): Promise<StoredEvolutionCandidate[]> {
    const rows = await this.request<SupabaseCandidateRow[]>(
      "GET",
      `/rest/v1/jhadina_evolution_candidates?status=eq.PENDING&order=priority.desc,candidate_id.asc&limit=${Math.max(1, Math.min(limit, 500))}`,
    );
    return rows.map(fromRow);
  }

  async decide(
    candidateId: string,
    decision: Exclude<CandidateDecision, "PENDING">,
    actor: string,
    reason?: string,
  ): Promise<StoredEvolutionCandidate> {
    const existing = await this.get(candidateId);
    if (!existing) throw new Error(`Unknown evolution candidate: ${candidateId}`);
    if (existing.decision !== "PENDING") throw new Error(`Candidate ${candidateId} is already ${existing.decision}`);

    const rows = await this.request<SupabaseCandidateRow[]>(
      "PATCH",
      `/rest/v1/jhadina_evolution_candidates?candidate_id=eq.${encodeURIComponent(candidateId)}&status=eq.PENDING`,
      {
        status: decision,
        decided_by: actor,
        decided_at: new Date().toISOString(),
        decision_reason: reason ?? null,
      },
      { Prefer: "return=representation" },
    );
    if (rows.length !== 1) throw new Error(`Candidate ${candidateId} changed before decision could be recorded`);
    return fromRow(rows[0]);
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase candidate repository request failed (${response.status}): ${text}`);
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

interface SupabaseCandidateRow {
  candidate_id: string;
  audit_run_id: string;
  category: EvolutionCandidate["category"];
  title: string;
  problem: string;
  evidence_refs: string[];
  affected_paths: string[];
  risk: EvolutionCandidate["risk"];
  impact: number;
  confidence: number;
  recurrence: number;
  change_size: number;
  priority: number;
  suggested_change: string;
  verification_plan: string[];
  discovered_at: string;
  proposal_hash: string;
  status: CandidateDecision;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
}

function toRow(candidate: EvolutionCandidate, existing?: StoredEvolutionCandidate): Omit<SupabaseCandidateRow, "status" | "decision_reason" | "decided_by" | "decided_at"> & Partial<Pick<SupabaseCandidateRow, "status" | "decision_reason" | "decided_by" | "decided_at">> {
  return {
    candidate_id: candidate.candidateId,
    audit_run_id: candidate.auditRunId,
    category: candidate.category,
    title: candidate.title,
    problem: candidate.problem,
    evidence_refs: candidate.evidenceRefs,
    affected_paths: candidate.affectedPaths,
    risk: candidate.risk,
    impact: candidate.impact,
    confidence: candidate.confidence,
    recurrence: candidate.recurrence,
    change_size: candidate.changeSize,
    priority: candidate.priority,
    suggested_change: candidate.suggestedChange,
    verification_plan: candidate.verificationPlan,
    discovered_at: candidate.discoveredAt,
    proposal_hash: candidate.proposalHash,
    status: existing?.decision ?? "PENDING",
    decision_reason: existing?.decisionReason ?? null,
    decided_by: existing?.decisionBy ?? null,
    decided_at: existing?.decisionAt ?? null,
  };
}

function fromRow(row: SupabaseCandidateRow): StoredEvolutionCandidate {
  return {
    candidateId: row.candidate_id,
    auditRunId: row.audit_run_id,
    category: row.category,
    title: row.title,
    problem: row.problem,
    evidenceRefs: row.evidence_refs,
    affectedPaths: row.affected_paths,
    risk: row.risk,
    impact: row.impact,
    confidence: row.confidence,
    recurrence: row.recurrence,
    changeSize: row.change_size,
    priority: row.priority,
    suggestedChange: row.suggested_change,
    verificationPlan: row.verification_plan,
    discoveredAt: row.discovered_at,
    proposalHash: row.proposal_hash,
    decision: row.status,
    decisionReason: row.decision_reason ?? undefined,
    decisionBy: row.decided_by ?? undefined,
    decisionAt: row.decided_at ?? undefined,
  };
}
