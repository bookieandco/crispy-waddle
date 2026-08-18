import { describe, expect, it } from "vitest";
import { planInstrumentReplacement, type ReplacementSegment } from "./instrument-replacement-planner.js";
import type { InstrumentFingerprint, InstrumentReplacementCandidate } from "./instrument-replacement.js";

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

const candidate: InstrumentReplacementCandidate = {
  id: "piano-reconstruction-1",
  label: "Matched piano reconstruction",
  fingerprint: { ...fingerprint, spectralCentroidHz: 1850 },
  sourceArtifactId: "stem-damaged-piano",
  replacementArtifactId: "stem-replacement-piano",
};

const segments: ReplacementSegment[] = [
  { startMs: 12400, endMs: 16800, damageSeverity: 0.7 },
];

describe("instrument replacement planner", () => {
  it("prefers localized replacement for localized damage", () => {
    const plan = planInstrumentReplacement({
      observed: fingerprint,
      candidate,
      damagedSegments: segments,
      gainEvidence: { method: "spectral A/B estimate", expectedGain: 0.7, confidence: 0.9 },
    });
    expect(plan.decision.replace).toBe(true);
    expect(plan.scope).toBe("segments");
    expect(plan.segments).toEqual(segments);
    expect(plan.decision.requiresApproval).toBe(true);
  });

  it("rejects overlapping segments before planning", () => {
    expect(() => planInstrumentReplacement({
      observed: fingerprint,
      candidate,
      damagedSegments: [
        { startMs: 1000, endMs: 3000, damageSeverity: 0.8 },
        { startMs: 2500, endMs: 4000, damageSeverity: 0.8 },
      ],
      gainEvidence: { method: "test", expectedGain: 0.8, confidence: 0.9 },
    })).toThrow("must not overlap");
  });

  it("rejects empty damage scope", () => {
    expect(() => planInstrumentReplacement({
      observed: fingerprint,
      candidate,
      damagedSegments: [],
      gainEvidence: { method: "test", expectedGain: 0.8, confidence: 0.9 },
    })).toThrow("at least one damaged segment");
  });
});
