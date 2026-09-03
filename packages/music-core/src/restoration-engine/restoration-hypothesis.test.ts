import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeHypothesisPosteriors,
  updateHypothesisPosterior,
  validateRestorationHypothesisSet,
  type RestorationHypothesis,
} from "./restoration-hypothesis.js";

const hypotheses: RestorationHypothesis[] = [
  { id: "damage", kind: "damage", label: "Tape damage", prior: 0.6, observations: [] },
  { id: "intentional", kind: "intentional", label: "Intentional production", prior: 0.4, observations: [] },
];

test("validates normalized hypothesis priors", () => {
  validateRestorationHypothesisSet({
    id: "hs-1",
    caseId: "case-1",
    sourceVersionId: "version-1",
    evidenceIds: ["e-1"],
    hypotheses,
  });
});

test("rejects malformed priors", () => {
  assert.throws(() => validateRestorationHypothesisSet({
    id: "hs-1",
    caseId: "case-1",
    sourceVersionId: "version-1",
    evidenceIds: [],
    hypotheses: [{ ...hypotheses[0], prior: 1.2 }, hypotheses[1]],
  }));
});

test("updates and normalizes posterior mass", () => {
  const updated = hypotheses.map((hypothesis) =>
    updateHypothesisPosterior(hypothesis, hypothesis.id === "damage" ? 0.5 : 0.25),
  );
  const normalized = normalizeHypothesisPosteriors(updated);
  assert.equal(normalized[0].posterior, 0.75);
  assert.equal(normalized[1].posterior, 0.25);
});
