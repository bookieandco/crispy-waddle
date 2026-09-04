import assert from "node:assert/strict";
import test from "node:test";
import { authorizeCompiledRestorationPlan } from "./plan-gate-integration.js";
import type { MusicDirectorJudgment } from "./music-director-judgment.js";
import type { RestorationPlan, RestorationQcResult } from "./types.js";

const qc: RestorationQcResult = {
  passed: true,
  conservationPassed: true,
  authenticityPassed: true,
  artifactFree: true,
  reasons: [],
};

function fixture(overrides: Partial<RestorationPlan> = {}): RestorationPlan {
  return {
    id: "plan-1",
    caseId: "case-1",
    sourceVersionId: "version-1",
    declaredDamageRegion: { startSample: 100, endSample: 200 },
    allowedPropagationRegion: { startSample: 100, endSample: 200 },
    evidenceIds: ["evidence-1"],
    candidates: [{
      id: "candidate-1",
      operation: "declick",
      operationClass: "correction",
      status: "qc-passed",
      inputArtifactId: "source-1",
      parameters: {},
      evidenceIds: ["evidence-1"],
      provenance: "derived",
    }],
    requiresApproval: false,
    ...overrides,
  };
}

function judgment(overrides: Partial<MusicDirectorJudgment> = {}): MusicDirectorJudgment {
  return {
    id: "judgment-1",
    planId: "plan-1",
    candidateId: "candidate-1",
    sourceArtifactId: "source-1",
    decision: "restore",
    confidence: 0.95,
    evidenceIds: ["evidence-1"],
    reasons: [],
    hardConstraintFailures: [],
    requiresHumanReview: false,
    ...overrides,
  };
}

test("compiled plan must pass the existing deterministic gate before execution authorization", () => {
  const authorization = authorizeCompiledRestorationPlan({
    plan: fixture(),
    candidateId: "candidate-1",
    judgment: judgment(),
    qc,
  });
  assert.equal(authorization.authorized, true);
});

test("plan approval remains a hard boundary", () => {
  const authorization = authorizeCompiledRestorationPlan({
    plan: fixture({ requiresApproval: true }),
    candidateId: "candidate-1",
    judgment: judgment(),
    qc,
  });
  assert.equal(authorization.authorized, false);
});

test("QC failure cannot be bypassed by a positive Director judgment", () => {
  const authorization = authorizeCompiledRestorationPlan({
    plan: fixture(),
    candidateId: "candidate-1",
    judgment: judgment(),
    qc: { ...qc, authenticityPassed: false },
  });
  assert.equal(authorization.authorized, false);
});

test("nonexistent candidate fails closed", () => {
  assert.throws(() => authorizeCompiledRestorationPlan({
    plan: fixture(),
    candidateId: "not-in-plan",
    judgment: judgment({ candidateId: "not-in-plan" }),
    qc,
  }));
});
