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
if (
  execution.candidateId !== "candidate-001" ||
  execution.plan.id !== "candidate-001" ||
  execution.executionId !== "exec-001" ||
  execution.proposalHash !== "abc123"
) {
  throw new Error("approved candidate did not produce the expected bound execution plan");
}

const blockedCases: Array<{
  name: string;
  candidate: EvolutionCandidateSnapshot;
  executionId: string;
}> = [
  { name: "unapproved", candidate: { ...approved, status: "pending" }, executionId: "exec-001" },
  { name: "missing receipt", candidate: { ...approved, decidedAt: null }, executionId: "exec-001" },
  { name: "missing execution binding", candidate: { ...approved, executionId: null }, executionId: "exec-001" },
  { name: "execution mismatch", candidate: approved, executionId: "exec-002" },
  { name: "protected path", candidate: { ...approved, affectedPaths: ["policy/foo.ts"] }, executionId: "exec-001" },
];

for (const { name, candidate, executionId } of blockedCases) {
  let blocked = false;
  try {
    gate.approve(candidate, executionId);
  } catch {
    blocked = true;
  }
  if (!blocked) throw new Error(`${name} candidate was incorrectly executable`);
}
