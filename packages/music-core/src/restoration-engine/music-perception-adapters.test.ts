import { describe, expect, it } from "vitest";
import { audioFluxToEvidence, MUSE_TASKS, museTrialToEvidence, omnizartToEvidence } from "./music-perception-adapters.js";

const context = {
  sourceArtifactId: "artifact-1",
  sourceVersionId: "version-1",
  caseId: "case-1",
  startSample: 100,
  endSample: 500,
};

describe("music perception adapters", () => {
  it("normalizes AudioFlux features as evidence", () => {
    const [evidence] = audioFluxToEvidence(context, [{ feature: "cqt", values: [1, 2, 3], confidence: 0.9 }]);
    expect(evidence.kind).toBe("audioflux.cqt");
    expect(evidence.region).toEqual({ startSample: 100, endSample: 500 });
    expect(evidence.confidence).toBe(0.9);
  });

  it("preserves Omnizart structural events as evidence", () => {
    const [evidence] = omnizartToEvidence(context, [{ kind: "drum", events: [{ onset: 0.25, class: "kick" }], confidence: 0.8 }]);
    expect(evidence.kind).toBe("omnizart.drum");
    expect(evidence.data?.eventCount).toBe(1);
  });

  it("keeps MUSE in evaluation-only territory", () => {
    const evidence = museTrialToEvidence(context, { task: "meter", correct: true, model: "test-model", confidence: 0.7 });
    expect(evidence.kind).toBe("benchmark.muse.meter");
    expect(evidence.data?.correct).toBe(1);
    expect(MUSE_TASKS).toHaveLength(10);
  });

  it("rejects malformed feature values instead of manufacturing evidence", () => {
    expect(() => audioFluxToEvidence(context, [{ feature: "cqt", values: [Number.NaN] }])).toThrow();
  });
});
