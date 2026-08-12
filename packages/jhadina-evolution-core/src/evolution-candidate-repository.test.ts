import { describe, expect, it } from "vitest";
import { InMemoryEvolutionCandidateRepository, persistEvolutionCandidates } from "./evolution-candidate-repository";
import type { EvolutionCandidate } from "./daily-evolution-candidates";

const candidate = (id: string, priority: number): EvolutionCandidate => ({
  candidateId: id,
  auditRunId: "daily-1",
  category: "ISSUE",
  title: `Candidate ${id}`,
  problem: "problem",
  evidenceRefs: ["evidence"],
  affectedPaths: [],
  risk: "LOW",
  impact: priority,
  confidence: 0,
  recurrence: 0,
  changeSize: 0,
  priority,
  suggestedChange: "fix",
  verificationPlan: ["pnpm test"],
  discoveredAt: "2026-08-10T00:00:00.000Z",
  proposalHash: `hash-${id}`,
});

describe("EvolutionCandidateRepository", () => {
  it("persists candidates as pending and ranks them by priority", async () => {
    const repo = new InMemoryEvolutionCandidateRepository();
    await persistEvolutionCandidates(repo, [candidate("low", 2), candidate("high", 10)]);
    const pending = await repo.listPending();
    expect(pending.map((item) => item.candidateId)).toEqual(["high", "low"]);
  });

  it("preserves an existing decision when a candidate is re-observed", async () => {
    const repo = new InMemoryEvolutionCandidateRepository();
    await repo.upsert(candidate("same", 5));
    await repo.decide("same", "DEFERRED", "user-1", "later");
    const updated = await repo.upsert(candidate("same", 9));
    expect(updated.decision).toBe("DEFERRED");
    expect(updated.priority).toBe(9);
  });

  it("prevents a second decision", async () => {
    const repo = new InMemoryEvolutionCandidateRepository();
    await repo.upsert(candidate("once", 5));
    await repo.decide("once", "REJECTED", "user-1");
    await expect(repo.decide("once", "APPROVED", "user-1")).rejects.toThrow("already REJECTED");
  });
});
