import assert from "node:assert/strict";
import { test } from "node:test";
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

test("approved candidate produces an execution bound to approval and execution id", () => {
  const gate = new ApprovalExecutionGate();
  const execution = gate.approve(approved, "exec-001");

  assert.equal(execution.candidateId, "candidate-001");
  assert.equal(execution.plan.id, "candidate-001");
  assert.equal(execution.executionId, "exec-001");
  assert.equal(execution.proposalHash, "abc123");
});

test("unapproved candidates are blocked", () => {
  const gate = new ApprovalExecutionGate();
  assert.throws(() => gate.approve({ ...approved, status: "pending" }, "exec-001"), /not approved/);
});

test("missing approval receipts are blocked", () => {
  const gate = new ApprovalExecutionGate();
  assert.throws(() => gate.approve({ ...approved, decidedAt: null }, "exec-001"), /approval receipt/);
});

test("missing execution bindings are blocked", () => {
  const gate = new ApprovalExecutionGate();
  assert.throws(() => gate.approve({ ...approved, executionId: null }, "exec-001"), /execution binding/);
});

test("execution-id mismatches are blocked", () => {
  const gate = new ApprovalExecutionGate();
  assert.throws(() => gate.approve(approved, "exec-002"), /different execution/);
});

test("protected paths are blocked", () => {
  const gate = new ApprovalExecutionGate();
  assert.throws(
    () => gate.approve({ ...approved, affectedPaths: ["policy/foo.ts"] }, "exec-001"),
    /protected Jhadina authority boundary/,
  );
});
