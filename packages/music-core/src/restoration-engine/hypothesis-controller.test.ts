import { describe, expect, it } from "vitest";
import { stepHypothesisController } from "./hypothesis-controller.js";
import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import type { RestorationExperimentCandidate } from "./hypothesis-experiment.js";

const hypotheses: RestorationHypothesis[] = [
  { id: "damage", kind: "damage", label: "Damage", prior: 0.5, observations: [] },
  { id: "intentional", kind: "intentional", label: "Intentional", prior: 0.5, observations: [] },
];

const experiment: RestorationExperimentCandidate = {
  id: "exp-1",
  description: "Analyze a disputed region",
  affectedRegionIds: ["region-1"],
  outcomes: [
    { outcomeId: "supports-damage", hypothesisLikelihoods: { damage: 0.9, intentional: 0.1 } },
    { outcomeId: "supports-intentional", hypothesisLikelihoods: { damage: 0.1, intentional: 0.9 } },
  ],
  cost: 0.1,
  risk: 0,
  destructive: false,
  authorizationClass: "analysis",
};

const policy = {
  allowAnalysis: true,
  allowSimulation: false,
  allowRestoration: false,
  allowDestructive: false,
  maxRisk: 0.5,
  maxCost: 1,
  maxIterations: 3,
  minMaxPosterior: 0.95,
};

function input(state: Parameters<typeof stepHypothesisController>[0]["state"]) {
  return {
    state,
    experiments: [experiment],
    policy,
    authorizationFactory: () => ({
      caseId: state.caseId,
      sourceVersionId: state.sourceVersionId,
      experimentId: experiment.id,
      authorizationClass: experiment.authorizationClass,
      allowedRegionIds: ["region-1"],
      allowDestructive: false,
    }),
    runner: { run: async () => ({ outcomeId: "supports-damage", confidence: 1 }) },
    idFactory: { create: () => "evidence-1" },
  };
}

describe("stepHypothesisController", () => {
  it("stops when certainty is already sufficient", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses: [
      { ...hypotheses[0], prior: 0.99 },
      { ...hypotheses[1], prior: 0.01 },
    ], iteration: 0, spentCost: 0, evidence: [] };
    const result = await stepHypothesisController(input(state));
    expect(result.decision).toEqual({ kind: "stop", reason: "sufficient-certainty" });
  });

  it("executes one safe experiment and returns updated evidence", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses, iteration: 0, spentCost: 0, evidence: [] };
    const result = await stepHypothesisController(input(state));
    expect(result.decision.kind).toBe("continue");
    expect(result.state.iteration).toBe(1);
    expect(result.state.spentCost).toBe(0.1);
    expect(result.state.evidence[0]?.evidenceId).toBe("evidence-1");
    expect(result.state.hypotheses[0]?.posterior).toBeCloseTo(0.9);
  });

  it("uses current posterior rather than resetting to the original prior", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses: [
      { ...hypotheses[0], posterior: 0.9 },
      { ...hypotheses[1], posterior: 0.1 },
    ], iteration: 1, spentCost: 0.1, evidence: [] };
    const result = await stepHypothesisController(input(state));
    expect(result.state.hypotheses[0]?.posterior).toBeCloseTo(0.988, 3);
  });

  it("stops at the iteration budget without executing", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses, iteration: 3, spentCost: 0.2, evidence: [] };
    const result = await stepHypothesisController(input(state));
    expect(result.decision).toEqual({ kind: "stop", reason: "max-iterations" });
  });

  it("stops when the cost budget is exhausted", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses, iteration: 1, spentCost: 1, evidence: [] };
    const result = await stepHypothesisController(input(state));
    expect(result.decision).toEqual({ kind: "stop", reason: "budget-exhausted" });
  });

  it("abstains when authorization fails", async () => {
    const state = { caseId: "case-1", sourceVersionId: "v1", hypotheses, iteration: 0, spentCost: 0, evidence: [] };
    const args = input(state);
    args.authorizationFactory = () => ({
      caseId: "wrong-case",
      sourceVersionId: "v1",
      experimentId: experiment.id,
      authorizationClass: experiment.authorizationClass,
      allowedRegionIds: ["region-1"],
      allowDestructive: false,
    });
    const result = await stepHypothesisController(args);
    expect(result.decision).toEqual({ kind: "abstain", reason: "execution-failed" });
    expect(result.state).toEqual(state);
  });
});
