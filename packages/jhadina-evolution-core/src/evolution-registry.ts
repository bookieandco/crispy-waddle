export type EvolutionStatus =
  | "NEW"
  | "INVESTIGATING"
  | "RECOMMENDED"
  | "DEFERRED"
  | "REJECTED"
  | "PROTOTYPED"
  | "APPROVED"
  | "IMPLEMENTED"
  | "VERIFIED"
  | "ROLLED_BACK";

export interface EvolutionCandidate {
  id: string;
  title: string;
  domain: string;
  description: string;
  status: EvolutionStatus;
  firstSeenAt: string;
  lastCheckedAt: string;
  evidence: Array<{ source: string; reference: string; summary: string }>;
  versionsChecked: string[];
  risk: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
  decision?: { by: string; at: string; reason: string };
}

export interface EvolutionRegistry {
  get(id: string): EvolutionCandidate | undefined;
  upsert(candidate: EvolutionCandidate): EvolutionCandidate;
  list(status?: EvolutionStatus): EvolutionCandidate[];
}

export class InMemoryEvolutionRegistry implements EvolutionRegistry {
  private readonly candidates = new Map<string, EvolutionCandidate>();

  get(id: string) {
    return this.candidates.get(id);
  }

  upsert(candidate: EvolutionCandidate) {
    const existing = this.candidates.get(candidate.id);
    const merged = existing
      ? { ...existing, ...candidate, firstSeenAt: existing.firstSeenAt }
      : candidate;
    this.candidates.set(candidate.id, merged);
    return merged;
  }

  list(status?: EvolutionStatus) {
    const values = [...this.candidates.values()];
    return status ? values.filter((candidate) => candidate.status === status) : values;
  }
}
