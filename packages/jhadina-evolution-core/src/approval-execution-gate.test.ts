import { ApprovalExecutionGate, type EvolutionCandidateSnapshot } from "./approval-execution-gate.js";

const approved: EvolutionCandidateSnapshot = {
  candidateId: "candidate-001",
  title: "Safe evolution",
  suggestedChange: "Improve a non-authority test helper.",
  risk: "low",
  affectedPaths: ["packages/example/src/helper.ts"],
  verificationPlan: ["pnpm test"],
  status: "approved",
  proposalHash: "abc123",
  decidedBy: "user-001",
  decidedAt: "2026-08-14T00:00:00Z",
  executionId: "exec-001",
};

const gate = new ApprovalExecutionGate();
const execution = gate.approve(approved, "exec-001");
if (execution.candidateId !== "candidate-001" || execution.plan.id !== "candidate-001") {
  throw new Error("approved candidate did not produce the expected execution plan");
}

for (const [name, candidate, executionId] of [
  ["unapproved", { ...approved, status: "pending" }, "exec-001"],
  ["missing receipt", { ...approved, decidedAt: null }, "exec-001"],
  ["execution mismatch", approved, "exec-002"],
  ["protected path", { ...approved, affectedPaths: ["policy/foo.ts"] }, "exec-001"],
] as const) {
  let blocked = false;
  try {
    gate.approve(candidate, executionId);
  } catch {
    blocked = true;
  }
  if (!blocked) throw new Error(`${name} candidate was incorrectly executable`);
}
