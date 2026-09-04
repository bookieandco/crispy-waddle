import { describe, expect, it } from "vitest";
import { buildRestorationRecommendation, resolveRestorationHypothesis } from "./hypothesis-resolution.js";
import type { RestorationHypothesis } from "./restoration-hypothesis.js";

const hypotheses: RestorationHypothesis[] = [
  { id: "damage", kind: "damage", label: "localized damage", prior: 0.5, observations: [{ evidenceId: "e1", likelihood: 0.9 }] , posterior: 0.9 },
  { id: "intentional", kind: "intentional", label: "intentional production", prior: 0.5, observations: [{ evidenceId: "e2", likelihood: 0.1 }], posterior: 0.1 },
];

describe("hypothesis resolution", () => {
  it("resolves a sufficiently supported dominant restoration hypothesis", () => {
    const resolution = resolveRestorationHypothesis(hypotheses, { minPosterior: 0.8, maxNormalizedEntropy: 0.6, minEvidenceCount: 1 });
    expect(resolution.status).toBe("resolved");
    expect(resolution.hypothesisId).toBe("damage");
    expect(buildRestorationRecommendation(resolution)).toEqual(expect.objectContaining({ operationClass: "RESTORATION", executionAuthorized: false }));
  });

  it("refuses resolution when evidence is insufficient", () => {
    const resolution = resolveRestorationHypothesis([{ ...hypotheses[0], observations: [] }], { minPosterior: 0.8, maxNormalizedEntropy: 0, minEvidenceCount: 1 });
    expect(resolution.status).toBe("unresolved");
    expect(resolution.reason).toBe("insufficient-evidence");
  });

  it("keeps intentional and performance hypotheses in review", () => {
    const intentional: RestorationHypothesis = { id: "p", kind: "performance", label: "performance", prior: 1, observations: [{ evidenceId: "e", likelihood: 1 }], posterior: 1 };
    const resolution = resolveRestorationHypothesis([intentional], { minPosterior: 0.9, maxNormalizedEntropy: 0, minEvidenceCount: 1 });
    expect(buildRestorationRecommendation(resolution).operationClass).toBe("REVIEW");
    expect(buildRestorationRecommendation(resolution).executionAuthorized).toBe(false);
  });
});
