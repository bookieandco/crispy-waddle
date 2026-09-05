import { describe, expect, it } from "vitest";
import { buildCorrespondenceEdge, createContinuityNode, selectRecoveryCorrespondence } from "./music-continuity-graph.js";

const a = createContinuityNode({ id: "a", caseId: "case", artifactId: "damaged", versionId: "v1", region: { startSample: 100, endSample: 200 } });
const b = createContinuityNode({ id: "b", caseId: "case", artifactId: "reference", versionId: "v2", region: { startSample: 1000, endSample: 1100 } });

describe("music continuity graph", () => {
  it("combines independent correspondence evidence conservatively", () => {
    const edge = buildCorrespondenceEdge(a, b, "same-performance", [
      { source: "olaf", evidenceId: "o1", score: 0.95, confidence: 0.9 },
      { source: "crepe", evidenceId: "c1", score: 0.9, confidence: 0.8 },
      { source: "omnizart", evidenceId: "m1", score: 0.8, confidence: 0.7 },
    ], { offsetSamples: 900, driftPpm: 3 });
    expect(edge.confidence).toBeGreaterThan(0.8);
    expect(edge.provenance).toEqual(["o1", "c1", "m1"]);
    expect(edge.alignment?.offsetSamples).toBe(900);
  });

  it("rejects self edges and invalid evidence", () => {
    expect(() => buildCorrespondenceEdge(a, a, "same-recording", [{ source: "olaf", evidenceId: "x", score: 1, confidence: 1 }])).toThrow();
    expect(() => buildCorrespondenceEdge(a, b, "same-song", [{ source: "olaf", evidenceId: "x", score: 2, confidence: 1 }])).toThrow();
  });

  it("does not promote weak, unknown, or different-performance matches", () => {
    const strong = buildCorrespondenceEdge(a, b, "alternate-transfer", [{ source: "olaf", evidenceId: "o", score: 0.95, confidence: 0.95 }]);
    const weak = buildCorrespondenceEdge(a, b, "same-song", [{ source: "crepe", evidenceId: "c", score: 0.4, confidence: 0.8 }]);
    const different = buildCorrespondenceEdge(a, b, "different-performance", [{ source: "omnizart", evidenceId: "m", score: 1, confidence: 1 }]);
    const unknown = buildCorrespondenceEdge(a, b, "unknown", [{ source: "miditok", evidenceId: "t", score: 1, confidence: 1 }]);
    expect(selectRecoveryCorrespondence([strong, weak, different, unknown])).toHaveLength(1);
    expect(selectRecoveryCorrespondence([strong])[0]?.kind).toBe("alternate-transfer");
  });
});
