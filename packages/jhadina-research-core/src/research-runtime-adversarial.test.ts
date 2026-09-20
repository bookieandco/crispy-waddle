import assert from "node:assert/strict";
import test from "node:test";
import { evaluateKnowledgeCandidate, type KnowledgeCandidate } from "./knowledge-candidate.js";
import { normalizeResearchPolicyDecision } from "./policy-normalization.js";
import { GovernedResearchExecutor, type ResearchProvider } from "./research-executor.js";
import { buildResearchQueuePlan, validateResearchQueue, type ResearchQueue } from "./research-queue.js";
import type {
  ResearchCommitResult,
  ResearchProviderSubmission,
  ResearchRuntimeRepository,
} from "./runtime-repository.js";
import {
  assertResearchRuntimeAdmission,
  researchPlanToQueue,
  type PersistedResearchPlan,
  type ResearchRuntimeAdmission,
} from "./runtime-reconciliation.js";

const plan = (overrides: Partial<PersistedResearchPlan> = {}): PersistedResearchPlan => ({
  id: "plan-1",
  intentId: "intent-1",
  planVersion: 1,
  status: "approved",
  budget: { maxCost: 10, maxRisk: 10 },
  tasks: [{
    id: "task-1",
    objective: "verify primary source",
    dependencies: [],
    priority: 1,
    expectedValue: 2,
    cost: 1,
    risk: 0.1,
    authorizationClass: "analysis",
    state: "ready",
    evidenceIds: [],
  }],
  ...overrides,
});

const admission = (overrides: Partial<ResearchRuntimeAdmission> = {}): ResearchRuntimeAdmission => ({
  planId: "plan-1",
  policyDecisionId: "policy-1",
  leaseId: "lease-1",
  leaseToken: "lease-token",
  workerId: "worker-1",
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...overrides,
});

type RepoOptions = {
  claim?: ResearchRuntimeAdmission;
  renew?: ResearchRuntimeAdmission;
  submissionStatus?: ResearchProviderSubmission["status"];
  evidenceCommit?: ResearchCommitResult;
  taskCommit?: ResearchCommitResult;
};

function makeRepository(options: RepoOptions = {}) {
  const calls: string[] = [];
  let evidenceSequence = 0;
  const repo: ResearchRuntimeRepository = {
    async loadPlan() {
      calls.push("loadPlan");
      return plan();
    },
    async claimExecution() {
      calls.push("claimExecution");
      return options.claim === undefined ? admission() : options.claim;
    },
    async renewExecutionLease() {
      calls.push("renewExecutionLease");
      return options.renew === undefined ? admission() : options.renew;
    },
    async reserveProviderSubmission() {
      calls.push("reserveProviderSubmission");
      return {
        id: "submission-1",
        planId: "plan-1",
        leaseId: "lease-1",
        taskId: "task-1",
        providerId: "provider-1",
        idempotencyKey: "plan-1:1:task-1:provider-1",
        status: options.submissionStatus ?? "reserved",
      };
    },
    async acknowledgeProviderSubmission() {
      calls.push("acknowledgeProviderSubmission");
      return {
        id: "submission-1",
        planId: "plan-1",
        leaseId: "lease-1",
        taskId: "task-1",
        providerId: "provider-1",
        idempotencyKey: "plan-1:1:task-1:provider-1",
        status: "submitted",
      };
    },
    async markProviderRecoveryRequired() {
      calls.push("markProviderRecoveryRequired");
      return true;
    },
    async commitExecutionEvent(input) {
      calls.push(`commit:${input.eventType}`);
      if (input.eventType === "evidence_captured") {
        return options.evidenceCommit ?? { accepted: true, stopped: false, eventId: "event-evidence", sequenceNo: 3 };
      }
      if (input.eventType === "task_completed") {
        return options.taskCommit ?? { accepted: true, stopped: false, eventId: "event-complete", sequenceNo: 4 };
      }
      return { accepted: true, stopped: false, eventId: `event-${input.eventType}`, sequenceNo: 2 };
    },
    async captureEvidence(input) {
      calls.push("captureEvidence");
      assert.equal(input.admission.leaseToken, "lease-token");
      evidenceSequence += 1;
      return `evidence-${evidenceSequence}`;
    },
    async releaseExecution(_admission, state) {
      calls.push(`release:${state}`);
      return true;
    },
  };
  return { repo, calls };
}

function makeProvider() {
  let count = 0;
  const provider: ResearchProvider = {
    id: "provider-1",
    async execute() {
      count += 1;
      return {
        providerJobId: "job-1",
        evidence: [{
          sourceUri: "https://example.test/source",
          sourceKind: "web",
          authority: "official",
          trustScore: 0.9,
          contentHash: "abc123",
          excerpt: "verified excerpt",
        }],
        usage: { cost: 1, risk: 0.1, queries: 1, sources: 1, wallClockMs: 50 },
      };
    },
  };
  return { provider, calls: () => count };
}

test("expired execution admission is rejected", () => {
  const queue = researchPlanToQueue(plan());
  assert.throws(() => assertResearchRuntimeAdmission(
    queue,
    admission({ expiresAt: "2020-01-01T00:00:00.000Z" }),
    new Date("2026-09-20T00:00:00.000Z"),
  ), /expired or invalid/);
});

test("lease for another plan is rejected", () => {
  const queue = researchPlanToQueue(plan());
  assert.throws(
    () => assertResearchRuntimeAdmission(queue, admission({ planId: "plan-other" })),
    /does not match/,
  );
});

test("completed durable task is never re-scheduled", () => {
  const queue = researchPlanToQueue(plan({
    tasks: [{ ...plan().tasks[0], state: "completed", evidenceIds: ["e-1"] }],
  }));
  assert.equal(buildResearchQueuePlan(queue).ready.length, 0);
});

test("missing persisted budgets fail closed", () => {
  const queue = researchPlanToQueue(plan({ budget: {} }));
  assert.equal(buildResearchQueuePlan(queue).ready.length, 0);
});

test("dependency cycles remain rejected after persistence projection", () => {
  const cyclic: ResearchQueue = {
    id: "q",
    objective: "cycle",
    revision: 1,
    budget: { maxCost: 10, maxRisk: 10, spentCost: 0, accruedRisk: 0 },
    tasks: [
      { id: "a", objective: "a", dependencies: ["b"], priority: 0, expectedValue: 0, cost: 0, risk: 0, authorizationClass: "analysis", state: "ready", evidenceIds: [] },
      { id: "b", objective: "b", dependencies: ["a"], priority: 0, expectedValue: 0, cost: 0, risk: 0, authorizationClass: "analysis", state: "ready", evidenceIds: [] },
    ],
  };
  assert.throws(() => validateResearchQueue(cyclic), /cycle/);
});

test("research policy escalation maps only to canonical approval_required", () => {
  assert.equal(normalizeResearchPolicyDecision("allow"), "allow");
  assert.equal(normalizeResearchPolicyDecision("deny"), "deny");
  assert.equal(normalizeResearchPolicyDecision("escalate"), "approval_required");
});

test("unresolved contradiction disputes a knowledge candidate", () => {
  const candidate: KnowledgeCandidate = {
    id: "c", planId: "p", executionEventId: "ev", subject: "s", claim: "c",
    predicate: "asserts", object: {}, confidence: 0.8, evidenceIds: ["e1"],
    minimumAuthorityScore: 0.7, minimumSources: 1, requireFresh: true,
    contradictionState: "unresolved", status: "pending",
  };
  assert.deepEqual(
    evaluateKnowledgeCandidate(candidate, {
      evidenceCount: 1, distinctSources: 1, minimumAuthorityScore: 0.9,
      allVerified: true, allFresh: true,
    }),
    { status: "disputed", reasons: ["unresolved_contradiction"] },
  );
});

test("unverified, stale, weak or under-corroborated evidence cannot validate", () => {
  const candidate: KnowledgeCandidate = {
    id: "c", planId: "p", executionEventId: "ev", subject: "s", claim: "c",
    predicate: "asserts", object: {}, confidence: 0.8, evidenceIds: ["e1"],
    minimumAuthorityScore: 0.8, minimumSources: 2, requireFresh: true,
    contradictionState: "none", status: "pending",
  };
  const result = evaluateKnowledgeCandidate(candidate, {
    evidenceCount: 1, distinctSources: 1, minimumAuthorityScore: 0.5,
    allVerified: false, allFresh: false,
  });
  assert.equal(result.status, "rejected");
  assert.deepEqual(result.reasons.sort(), [
    "authority_below_threshold",
    "insufficient_source_corroboration",
    "stale_or_changed_evidence",
    "unverified_evidence",
  ].sort());
});

test("verified fresh corroborated evidence validates", () => {
  const candidate: KnowledgeCandidate = {
    id: "c", planId: "p", executionEventId: "ev", subject: "s", claim: "c",
    predicate: "asserts", object: {}, confidence: 0.9, evidenceIds: ["e1", "e2"],
    minimumAuthorityScore: 0.8, minimumSources: 2, requireFresh: true,
    contradictionState: "none", status: "pending",
  };
  assert.deepEqual(
    evaluateKnowledgeCandidate(candidate, {
      evidenceCount: 2, distinctSources: 2, minimumAuthorityScore: 0.85,
      allVerified: true, allFresh: true,
    }),
    { status: "validated", reasons: [] },
  );
});

test("failed admission never invokes a provider", async () => {
  const { repo } = makeRepository({ claim: undefined });
  // Override default helper behavior explicitly.
  repo.claimExecution = async () => undefined;
  const p = makeProvider();
  const result = await new GovernedResearchExecutor(repo, p.provider).executeNext({
    planId: "plan-1", policyDecisionId: "policy-1", workerId: "worker-1",
  });
  assert.equal(result.status, "fenced");
  assert.equal(p.calls(), 0);
});

test("already-submitted provider reservation prevents duplicate side effect", async () => {
  const { repo } = makeRepository({ submissionStatus: "submitted" });
  const p = makeProvider();
  const result = await new GovernedResearchExecutor(repo, p.provider).executeNext({
    planId: "plan-1", policyDecisionId: "policy-1", workerId: "worker-1",
  });
  assert.equal(result.status, "fenced");
  assert.equal(p.calls(), 0);
});

test("losing a lease after provider call fences result before evidence capture", async () => {
  const { repo, calls } = makeRepository();
  repo.renewExecutionLease = async () => {
    calls.push("renewExecutionLease");
    return undefined;
  };
  const p = makeProvider();
  const result = await new GovernedResearchExecutor(repo, p.provider).executeNext({
    planId: "plan-1", policyDecisionId: "policy-1", workerId: "worker-1",
  });
  assert.equal(result.status, "fenced");
  assert.equal(p.calls(), 1);
  assert.equal(calls.includes("captureEvidence"), false);
  assert.equal(calls.includes("acknowledgeProviderSubmission"), false);
  assert.equal(calls.includes("markProviderRecoveryRequired"), true);
});

test("hard budget stop rejects provider output before evidence persistence", async () => {
  const { repo, calls } = makeRepository({
    evidenceCommit: { accepted: false, stopped: true, reason: "query_budget_exhausted", eventId: "budget-event" },
  });
  const p = makeProvider();
  const result = await new GovernedResearchExecutor(repo, p.provider).executeNext({
    planId: "plan-1", policyDecisionId: "policy-1", workerId: "worker-1",
  });
  assert.deepEqual(result, { status: "stopped", reason: "query_budget_exhausted" });
  assert.equal(calls.includes("captureEvidence"), false);
  assert.equal(calls.includes("commit:task_completed"), false);
});

test("successful execution persists evidence before completing and acknowledging task", async () => {
  const { repo, calls } = makeRepository();
  const p = makeProvider();
  const result = await new GovernedResearchExecutor(repo, p.provider).executeNext({
    planId: "plan-1", policyDecisionId: "policy-1", workerId: "worker-1",
  });
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.deepEqual(result.evidenceIds, ["evidence-1"]);
  const evidenceEvent = calls.indexOf("commit:evidence_captured");
  const capture = calls.indexOf("captureEvidence");
  const taskComplete = calls.indexOf("commit:task_completed");
  const ack = calls.indexOf("acknowledgeProviderSubmission");
  assert.ok(evidenceEvent >= 0 && evidenceEvent < capture);
  assert.ok(capture < taskComplete);
  assert.ok(taskComplete < ack);
});
