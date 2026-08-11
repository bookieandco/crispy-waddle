import { ApprovalCenterApi } from "./approval-center-api";
import type { EvolutionCandidateRepository, StoredEvolutionCandidate } from "./evolution-candidate-repository";

function repository(candidate: StoredEvolutionCandidate): EvolutionCandidateRepository {
  let current = candidate;
  return {
    async upsert(value) { current = { ...value, decision: current.decision }; return current; },
    async get() { return current; },
    async listPending() { return current.decision === "PENDING" ? [current] : []; },
    async decide(_id, decision, actor, reason) {
      if (current.decision !== "PENDING") throw new Error(`Candidate is already ${current.decision}`);
      current = { ...current, decision, decisionBy: actor, decisionAt: "2026-08-10T00:00:00.000Z", decisionReason: reason };
      return current;
    },
  };
}

const candidate = {
  candidateId: "candidate-1",
  auditRunId: "audit-1",
  category: "CI",
  title: "Fix failing check",
  problem: "A check is failing.",
  evidenceRefs: ["evidence-1"],
  affectedPaths: ["packages/example.ts"],
  risk: "LOW",
  impact: 4,
  confidence: 5,
  recurrence: 1,
  changeSize: 1,
  priority: 7,
  suggestedChange: "Fix the failing check.",
  verificationPlan: ["pnpm test"],
  discoveredAt: "2026-08-10T00:00:00.000Z",
  proposalHash: "proposal-hash",
  decision: "PENDING" as const,
};

test("lists pending candidates", async () => {
  const api = new ApprovalCenterApi(repository(candidate));
  const result = await api.list();
  if (result.candidates[0]?.candidateId !== "candidate-1") throw new Error("candidate missing");
});

test("records an approval with actor and reason", async () => {
  const api = new ApprovalCenterApi(repository(candidate));
  const result = await api.decide({
    candidateId: "candidate-1",
    action: "approve",
    actor: { actorId: "user-1" },
    reason: "Approved after review",
  });
  if (result.candidate.decision !== "APPROVED") throw new Error("approval not recorded");
  if (result.candidate.decisionBy !== "user-1") throw new Error("actor not recorded");
});

test("rejects missing actor", async () => {
  const api = new ApprovalCenterApi(repository(candidate));
  await expectError(() => api.decide({ candidateId: "candidate-1", action: "approve", actor: { actorId: "" } }));
});

async function expectError(fn: () => Promise<unknown>) {
  let failed = false;
  try { await fn(); } catch { failed = true; }
  if (!failed) throw new Error("expected operation to fail");
}
