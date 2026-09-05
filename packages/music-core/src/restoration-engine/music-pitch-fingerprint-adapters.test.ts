import { describe, expect, it } from "vitest";
import { crepeToEvidence, olafMatchesToEvidence } from "./music-pitch-fingerprint-adapters.js";
import type { MusicPerceptionAdapterContext } from "./music-perception-adapters.js";

const context: MusicPerceptionAdapterContext = {
  sourceArtifactId: "artifact-1",
  sourceVersionId: "version-1",
  caseId: "case-1",
  startSample: 100,
  endSample: 200,
};

describe("music pitch/fingerprint adapters", () => {
  it("converts CREPE pitch observations to evidence", () => {
    const evidence = crepeToEvidence(context, [
      { timeSeconds: 0, frequencyHz: 220, confidence: 0.9 },
      { timeSeconds: 0.01, frequencyHz: 221, confidence: 0.8 },
    ]);
    expect(evidence.kind).toBe("pitch.crepe");
    expect(evidence.confidence).toBeCloseTo(0.85);
    expect(evidence.data.caseId).toBe("case-1");
  });

  it("rejects invalid CREPE confidence", () => {
    expect(() => crepeToEvidence(context, [{ timeSeconds: 0, frequencyHz: 220, confidence: 2 }])).toThrow();
  });

  it("keeps Olaf matches as correspondence evidence", () => {
    const evidence = olafMatchesToEvidence(context, [{
      referenceId: "alternate-transfer-7",
      score: 0.92,
      queryStartSample: 100,
      referenceStartSample: 5000,
      offsetSamples: 4900,
    }]);
    expect(evidence[0]?.kind).toBe("correspondence.olaf");
    expect(evidence[0]?.data.referenceId).toBe("alternate-transfer-7");
  });

  it("rejects invalid correspondence scores", () => {
    expect(() => olafMatchesToEvidence(context, [{ referenceId: "bad", score: 1.2 }])).toThrow();
  });
});
