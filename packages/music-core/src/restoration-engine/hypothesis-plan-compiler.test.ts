import { describe, expect, it } from "vitest";
import { compileResolvedHypothesisToPlan } from "./hypothesis-plan-compiler.js";
import type { RestorationResolution } from "./hypothesis-resolution.js";

const resolved: RestorationResolution = {
  hypothesisId: "damage",
  kind: "damage",
  posterior: 0.95,
  uncertainty: { entropy: 0.29, normalizedEntropy: 0.29, maxPosterior: 0.95, effectiveHypothesisCount: 1.22 },
  evidenceIds: ["e1", "e2"],
  status: "resolved",
  reason: "dominant-supported-hypothesis",
};

const input = {
  resolution: resolved,
  caseId: "case-1",
  sourceVersionId: "source-1",
  inputArtifactId: "artifact-1",
  region: { startSample: 100, endSample: 200 },
  operation: "declick",
  parameters: { strength: 0.4 },
  planId: "plan-1",
  candidateId: "candidate-1",
};

describe("hypothesis plan compiler", () => {
  it("compiles a resolved damage hypothesis into a bounded proposed plan", () => {
    const plan = compileResolvedHypothesisToPlan(input);
    expect(plan.operationClass).toBeUndefined();
    expect(plan.declaredDamageRegion).toEqual({ startSample: 100, endSample: 200 });
    expect(plan.allowedPropagationRegion).toEqual({ startSample: 100, endSample: 200 });
    expect(plan.requiresApproval).toBe(true);
    expect(plan.candidates[0]).toEqual(expect.objectContaining({
      id: "candidate-1",
      operation: "declick",
      operationClass: "correction",
      status: "proposed",
      provenance: "derived",
      evidenceIds: ["e1", "e2"],
    }));
  });

  it("rejects unresolved hypotheses", () => {
    expect(() => compileResolvedHypothesisToPlan({ ...input, resolution: { ...resolved, status: "unresolved" } })).toThrow("Only resolved hypotheses");
  });

  it("rejects intentional hypotheses even when marked resolved", () => {
    expect(() => compileResolvedHypothesisToPlan({ ...input, resolution: { ...resolved, kind: "intentional" } })).toThrow("not eligible");
  });

  it("rejects invalid or unbounded regions", () => {
    expect(() => compileResolvedHypothesisToPlan({ ...input, region: { startSample: 200, endSample: 200 } })).toThrow("valid positive sample range");
  });
});
