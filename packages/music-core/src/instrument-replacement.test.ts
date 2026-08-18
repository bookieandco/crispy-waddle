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

describe("instrument fingerprint replacement", () => {
  it("scores a timbrally similar replacement highly", () => {
    const score = compareInstrumentFingerprints(fingerprint, {
      ...fingerprint,
      spectralCentroidHz: 1850,
      spectralSpreadHz: 2250,
    });
    expect(score).toBeGreaterThan(0.95);
  });

  it("requires both fingerprint similarity and restoration gain", () => {
    const candidate = {
      id: "piano-reconstruction-1",
      label: "Matched piano reconstruction",
      fingerprint,
      sourceArtifactId: "stem-damaged-piano",
      replacementArtifactId: "stem-replacement-piano",
    };

    const accepted = decideInstrumentReplacement({
      observed: fingerprint,
      candidate,
      expectedRestorationGain: 0.7,
    });
    expect(accepted.replace).toBe(true);
    expect(accepted.requiresApproval).toBe(true);
    expect(accepted.candidateId).toBe(candidate.id);

    const rejected = decideInstrumentReplacement({
      observed: fingerprint,
      candidate,
      expectedRestorationGain: 0.05,
    });
    expect(rejected.replace).toBe(false);
    expect(rejected.candidateId).toBeUndefined();
  });
});
