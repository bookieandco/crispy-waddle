import { describe, expect, it } from "vitest";
import {
  compareInstrumentFingerprints,
  decideInstrumentReplacement,
  type InstrumentFingerprint,
} from "./instrument-replacement";

const fingerprint: InstrumentFingerprint = {
  family: "piano",
  spectralCentroidHz: 1800,
  spectralSpreadHz: 2200,
  lowEnergyRatio: 0.25,
  midEnergyRatio: 0.5,
  highEnergyRatio: 0.25,
  transientStrength: 0.62,
  harmonicity: 0.86,
};

const candidate = {
  id: "piano-reconstruction-1",
  label: "Matched piano reconstruction",
  fingerprint,
  sourceArtifactId: "stem-damaged-piano",
  replacementArtifactId: "stem-replacement-piano",
};

describe("instrument fingerprint replacement", () => {
  it("scores a timbrally similar replacement highly", () => {
    const score = compareInstrumentFingerprints(fingerprint, {
      ...fingerprint,
      spectralCentroidHz: 1850,
      spectralSpreadHz: 2250,
    });
    expect(score).toBeGreaterThan(0.95);
  });

  it("requires family, similarity, gain, and gain-evidence confidence", () => {
    const accepted = decideInstrumentReplacement({
      observed: fingerprint,
      candidate,
      gainEvidence: { method: "validated-preview-model", expectedGain: 0.7, confidence: 0.9 },
    });
    expect(accepted.replace).toBe(true);
    expect(accepted.requiresApproval).toBe(true);
    expect(accepted.candidateId).toBe(candidate.id);

    const lowGain = decideInstrumentReplacement({
      observed: fingerprint,
      candidate,
      gainEvidence: { method: "validated-preview-model", expectedGain: 0.05, confidence: 0.9 },
    });
    expect(lowGain.replace).toBe(false);
    expect(lowGain.candidateId).toBeUndefined();

    const lowConfidence = decideInstrumentReplacement({
      observed: fingerprint,
      candidate,
      gainEvidence: { method: "weak-estimate", expectedGain: 0.7, confidence: 0.4 },
    });
    expect(lowConfidence.replace).toBe(false);
  });

  it("rejects a different instrument family even when timbre is otherwise close", () => {
    const rejected = decideInstrumentReplacement({
      observed: fingerprint,
      candidate: {
        ...candidate,
        fingerprint: { ...fingerprint, family: "organ" },
      },
      gainEvidence: { method: "validated-preview-model", expectedGain: 0.9, confidence: 0.95 },
    });
    expect(rejected.replace).toBe(false);
    expect(rejected.reason).toMatch(/family/);
  });

  it("rejects a candidate that points to the same artifact as the source", () => {
    expect(() => decideInstrumentReplacement({
      observed: fingerprint,
      candidate: { ...candidate, replacementArtifactId: candidate.sourceArtifactId },
      gainEvidence: { method: "validated-preview-model", expectedGain: 0.9, confidence: 0.95 },
    })).toThrow(/differ from the damaged source/);
  });

  it("rejects malformed fingerprint values instead of producing misleading scores", () => {
    expect(() => compareInstrumentFingerprints(
      { ...fingerprint, highEnergyRatio: 1.5 },
      fingerprint,
    )).toThrow(/between 0 and 1/);
  });
});
