import { describe, expect, it } from "vitest";
import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import { calculateExpectedInformationGain, selectSafeRestorationExperiment, type RestorationExperimentCandidate } from "./hypothesis-experiment.js";

const hypotheses: RestorationHypothesis[] = [
  { id: "damage", kind: "damage", label: "damage", prior: 0.5, observations: [] },
  { id: "intentional", kind: "intentional", label: "intentional", prior: 0.5, observations: [] },
];

const discriminating: RestorationExperimentCandidate = {
  id: "stereo-check",
  description: "Compare correlated stereo evidence without changing the source.",
  affectedRegionIds: ["region-1"],
  outcomes: [
    { outcomeId: "corroborated", hypothesisLikelihoods: { damage: 0.9, intentional: 0.1 } },
    { outcomeId: "not-corroborated", hypothesisLikelihoods: { damage: 0.1, intentional: 0.9 } },
  ],
  cost: 0.01,
  risk: 0.01,
  destructive: false,
  authorizationClass: "analysis",
};

describe("hypothesis experiment selection", () => {
  it("computes positive expected information gain for a discriminating experiment", () => {
    const score = calculateExpectedInformationGain(hypotheses, discriminating);
    expect(score.expectedInformationGain).toBeGreaterThan(0);
    expect(score.expectedPosteriorEntropy).toBeLessThan(1);
  });

  it("prefers the higher-utility safe experiment deterministically", () => {
    const result = selectSafeRestorationExperiment(
      hypotheses,
      [
        { ...discriminating, id: "z-check", cost: 0.02 },
        { ...discriminating, id: "a-check", cost: 0.01 },
      ],
      { allowAnalysis: true, allowSimulation: false, allowRestoration: false, allowDestructive: false, maxRisk: 0.5, maxCost: 1 },
    );
    expect(result?.experimentId).toBe("a-check");
  });

  it("never selects destructive work when policy forbids it, regardless of information gain", () => {
    const result = selectSafeRestorationExperiment(
      hypotheses,
      [{ ...discriminating, id: "destructive", destructive: true, cost: 0, risk: 0 }],
      { allowAnalysis: true, allowSimulation: true, allowRestoration: true, allowDestructive: false, maxRisk: 1, maxCost: 1 },
    );
    expect(result).toBeNull();
  });

  it("rejects incomplete outcome probability models", () => {
    expect(() => calculateExpectedInformationGain(hypotheses, {
      ...discriminating,
      outcomes: [{ outcomeId: "only", hypothesisLikelihoods: { damage: 1, intentional: 1 } }],
    })).toThrow(/sum to 1/);
  });

  it("does not permit restoration experiments unless explicitly authorized", () => {
    const result = selectSafeRestorationExperiment(
      hypotheses,
      [{ ...discriminating, id: "restore-probe", authorizationClass: "restoration" }],
      { allowAnalysis: true, allowSimulation: true, allowRestoration: false, allowDestructive: true, maxRisk: 1, maxCost: 1 },
    );
    expect(result).toBeNull();
  });
});
