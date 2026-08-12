import type { EvolutionCandidate } from "./daily-evolution-candidates";

export type CandidateDecision = "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED" | "EXPIRED";

export interface StoredEvolutionCandidate extends EvolutionCandidate {
  decision: CandidateDecision;
  decisionAt?: string;
  decisionBy?: string;
  decisionReason?: string;
}

export interface EvolutionCandidateRepository {
  upsert(candidate: EvolutionCandidate): Promise<StoredEvolutionCandidate>;
  get(candidateId: string): Promise<StoredEvolutionCandidate | undefined>;
  listPending(limit?: number): Promise<StoredEvolutionCandidate[]>;
  decide(candidateId: string, decision: Exclude<CandidateDecision, "PENDING">, actor: string, reason?: string): Promise<StoredEvolutionCandidate>;
}

export class InMemoryEvolutionCandidateRepository implements EvolutionCandidateRepository {
  private readonly candidates = new Map<string, StoredEvolutionCandidate>();

  async upsert(candidate: EvolutionCandidate): Promise<StoredEvolutionCandidate> {
    const existing = this.candidates.get(candidate.candidateId);
    const stored: StoredEvolutionCandidate = {
      ...candidate,
      decision: existing?.decision ?? "PENDING",
      decisionAt: existing?.decisionAt,
      decisionBy: existing?.decisionBy,
      decisionReason: existing?.decisionReason,
    };
    this.candidates.set(candidate.candidateId, stored);
    return stored;
  }

  async get(candidateId: string): Promise<StoredEvolutionCandidate | undefined> {
    return this.candidates.get(candidateId);
  }

  async listPending(limit = 50): Promise<StoredEvolutionCandidate[]> {
    return [...this.candidates.values()]
      .filter((candidate) => candidate.decision === "PENDING")
      .sort((a, b) => b.priority - a.priority || a.candidateId.localeCompare(b.candidateId))
      .slice(0, limit);
  }

  async decide(
    candidateId: string,
    decision: Exclude<CandidateDecision, "PENDING">,
    actor: string,
    reason?: string,
  ): Promise<StoredEvolutionCandidate> {
    const existing = this.candidates.get(candidateId);
    if (!existing) throw new Error(`Unknown evolution candidate: ${candidateId}`);
    if (existing.decision !== "PENDING") throw new Error(`Candidate ${candidateId} is already ${existing.decision}`);

    const updated: StoredEvolutionCandidate = {
      ...existing,
      decision,
      decisionAt: new Date().toISOString(),
      decisionBy: actor,
      decisionReason: reason,
    };
    this.candidates.set(candidateId, updated);
    return updated;
  }
}

export async function persistEvolutionCandidates(
  repository: EvolutionCandidateRepository,
  candidates: EvolutionCandidate[],
): Promise<StoredEvolutionCandidate[]> {
  const stored: StoredEvolutionCandidate[] = [];
  for (const candidate of candidates) stored.push(await repository.upsert(candidate));
  return stored;
}
