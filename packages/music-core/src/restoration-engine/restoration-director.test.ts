import { describe, expect, it } from "vitest";
import type { ListeningFrame } from "./listening-frame.js";
import type { RestorationCandidate, RestorationGateDecision, RestorationPlan, RestorationQcResult } from "./types.js";
import { compareListeningFrames } from "./listening-ab.js";
import { judgeMusicRestoration } from "./music-director-judgment.js";
import { authorizeRestorationExecution } from "./execution-authorization.js";

const frame = (overrides: Partial<ListeningFrame> = {}): ListeningFrame => ({
  id: "listen:source:0:1000",
  version: "1.0.0",
  sourceArtifactId: "source",
  region: { startSample: 0, endSample: 1000 },
  structure: { confidence: 1, barId: "bar-1" },
  eventIds: ["event-1"],
  voices: [],
  instruments: ["kick"],
  rhythm: { tempoBpm: 100, beatConfidence: 1, grooveConfidence: 1, evidenceIds: ["e-rhythm"] },
  dynamics: { rms: 0.2, peak: 0.8, crestFactor: 4, confidence: 1, evidenceIds: ["e-dyn"] },
  timbre: { descriptors: ["clear"], spectralCentroid: 2000, confidence: 1, evidenceIds: ["e-timbre"] },
  spatial: { stereoWidth: 0.5, phaseRisk: 0.1, confidence: 1, evidenceIds: ["e-space"] },
  performance: { confidence: 1, evidenceIds: ["e-performance"] },
  recording: { noiseLevel: 0.4, distortionLevel: 0.3, confidence: 1, evidenceIds: ["e-recording"] },
  anomalies: { damageEvidenceIds: ["damage-1"], eventIds: [], descriptors: ["click"], confidence: 1 },
  perceptualDescriptors: [{ descriptor: "clear", confidence: 1, evidenceIds: ["e-timbre"] }],
  musicalIntentHypotheses: [],
  evidenceIds: ["e-rhythm", "e-dyn", "e-timbre", "e-space", "e-performance", "e-recording", "damage-1"],
  confidence: 1,
  abstained: false,
  reasons: [],
  ...overrides,
});

const candidate: RestorationCandidate = {
  id: "candidate-1",
  operation: "declick",
  operationClass: "correction",
  status: "qc-passed",
  inputArtifactId: "source",
  outputArtifactId: "candidate-artifact",
  parameters: {},
  evidenceIds: ["damage-1"],
  provenance: "derived",
};

const plan: RestorationPlan = {
  id: "plan-1",
  caseId: "case-1",
  sourceVersionId: "source-version-1",
  declaredDamageRegion: { startSample: 0, endSample: 1000 },
  evidenceIds: ["damage-1"],
  candidates: [candidate],
  requiresApproval: false,
};

const qc: RestorationQcResult = {
  passed: true,
  conservationPassed: true,
  authenticityPassed: true,
  artifactFree: true,
  reasons: [],
};

const gate: RestorationGateDecision = {
  allowed: true,
  reason: "All deterministic restoration checks passed.",
  candidateId: "candidate-1",
};

describe("music restoration director boundary", () => {
  it("reports a candidate improvement without treating A/B as authorization", () => {
    const original = frame();
    const candidateFrame = frame({
      id: "listen:candidate-artifact:0:1000",
      sourceArtifactId: "candidate-artifact",
      recording: { noiseLevel: 0.1, distortionLevel: 0.1, confidence: 1, evidenceIds: ["e-recording-b"] },
      anomalies: { damageEvidenceIds: [], eventIds: [], descriptors: [], confidence: 1 },
      evidenceIds: [...original.evidenceIds, "e-recording-b"],
    });

    const comparison = compareListeningFrames(original, candidateFrame);
    expect(comparison.status).toBe("improved");
    expect(comparison.improvements).toContain("noise level decreased");
    expect(comparison.regressions).toHaveLength(0);
  });

  it("forces review when A/B evidence contains a regression", () => {
    const comparison = compareListeningFrames(
      frame(),
      frame({
        id: "listen:candidate-artifact:0:1000",
        sourceArtifactId: "candidate-artifact",
        recording: { noiseLevel: 0.8, distortionLevel: 0.9, confidence: 1, evidenceIds: ["e-recording-b"] },
        evidenceIds: [...frame().evidenceIds, "e-recording-b"],
      }),
    );
    const judgment = judgeMusicRestoration({ plan, comparison, candidateId: candidate.id, qc });
    expect(judgment.decision).toBe("review");
    expect(judgment.requiresHumanReview).toBe(true);
  });

  it("cannot execute unless Director, deterministic gate, and QC all agree", () => {
    const comparison = compareListeningFrames(
      frame(),
      frame({
        id: "listen:candidate-artifact:0:1000",
        sourceArtifactId: "candidate-artifact",
        recording: { noiseLevel: 0.1, distortionLevel: 0.1, confidence: 1, evidenceIds: ["e-recording-b"] },
        anomalies: { damageEvidenceIds: [], eventIds: [], descriptors: [], confidence: 1 },
        evidenceIds: [...frame().evidenceIds, "e-recording-b"],
      }),
    );
    const judgment = judgeMusicRestoration({ plan, comparison, candidateId: candidate.id, qc });
    const authorization = authorizeRestorationExecution({ plan, candidate, judgment, gate, qc });
    expect(authorization.authorized).toBe(false);
    expect(authorization.requiresHumanReview).toBe(true);
    expect(authorization.reasons.join(" ")).toContain("No audio mutation is authorized");
  });
});
