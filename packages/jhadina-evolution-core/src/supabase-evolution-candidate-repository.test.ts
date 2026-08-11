import { describe, expect, it } from "vitest";
import { SupabaseEvolutionCandidateRepository } from "./supabase-evolution-candidate-repository";
import type { EvolutionCandidate } from "./daily-evolution-candidates";

const candidate: EvolutionCandidate = {
  candidateId: "candidate-test-1",
  auditRunId: "daily-test-1",
  category: "DEPENDENCY",
  title: "Review outdated dependencies",
  problem: "A dependency is outdated.",
  evidenceRefs: ["evidence-1"],
  affectedPaths: ["package.json"],
  risk: "LOW",
  impact: 4,
  confidence: 9,
  recurrence: 0,
  changeSize: 2,
  priority: 11,
  suggestedChange: "Review the upgrade.",
  verificationPlan: ["pnpm test"],
  discoveredAt: "2026-08-10T00:00:00.000Z",
  proposalHash: "proposal-1",
};

function response(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("SupabaseEvolutionCandidateRepository", () => {
  it("upserts candidates and preserves an existing decision", async () => {
    const calls: Array<{ method: string; url: string; body?: any }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ method: init?.method ?? "GET", url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if ((init?.method ?? "GET") === "GET") return response([{ ...candidate, decision: "DEFERRED", decisionReason: "later" }]);
      return response([{ ...candidate, decision: "DEFERRED", decisionReason: "later" }]);
    };

    const repository = new SupabaseEvolutionCandidateRepository({ url: "https://example.supabase.co", key: "server-key", fetchImpl });
    const stored = await repository.upsert(candidate);

    expect(stored.decision).toBe("DEFERRED");
    expect(calls[1].body.status).toBe("DEFERRED");
    expect(calls[1].url).toContain("on_conflict=candidate_id");
  });

  it("only decides a candidate while it is still pending", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      if ((init?.method ?? "GET") === "GET") return response([{ ...candidate, decision: "PENDING" }]);
      return response([{ ...candidate, decision: "APPROVED" }]);
    };

    const repository = new SupabaseEvolutionCandidateRepository({ url: "https://example.supabase.co", key: "server-key", fetchImpl });
    const stored = await repository.decide(candidate.candidateId, "APPROVED", "00000000-0000-0000-0000-000000000001", "approved for execution");

    expect(stored.decision).toBe("APPROVED");
  });
});
