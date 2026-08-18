import { describe, expect, it } from "vitest";
import {
  createReconstructionResult,
  validateReconstructionRequest,
  type ReconstructionRequest,
} from "./instrument-reconstruction.js";

const base: ReconstructionRequest = {
  requestId: "req-1",
  sourceArtifactId: "damaged-piano",
  replacementArtifactId: "reconstructed-piano",
  instrumentFamily: "piano",
  scope: "segments",
  segments: [{ startMs: 12400, endMs: 16800 }],
  fingerprintSimilarity: 0.94,
  expectedGain: 0.71,
  gainConfidence: 0.89,
  approved: true,
};

describe("instrument reconstruction contract", () => {
  it("requires explicit human approval", () => {
    expect(() => validateReconstructionRequest({ ...base, approved: false })).toThrow("human approval");
  });

  it("rejects same source and replacement artifacts", () => {
    expect(() => validateReconstructionRequest({ ...base, replacementArtifactId: base.sourceArtifactId })).toThrow("must differ");
  });

  it("requires valid bounded confidence and similarity", () => {
    expect(() => validateReconstructionRequest({ ...base, fingerprintSimilarity: 1.1 })).toThrow("fingerprintSimilarity");
  });

  it("requires passing QC and preserves provenance", () => {
    const result = createReconstructionResult(
      base,
      {
        artifactId: "render-1",
        sourceArtifactId: base.sourceArtifactId,
        replacementArtifactId: base.replacementArtifactId,
        requestId: base.requestId,
        status: "rendered",
        createdAt: "2026-08-18T00:00:00Z",
      },
      { passed: true, method: "post-render analysis", findings: [] },
    );
    expect(result.provenance.sourceArtifactId).toBe(base.sourceArtifactId);
  });

  it("rejects failed QC", () => {
    expect(() => createReconstructionResult(
      base,
      {
        artifactId: "render-1",
        sourceArtifactId: base.sourceArtifactId,
        replacementArtifactId: base.replacementArtifactId,
        requestId: base.requestId,
        status: "rendered",
        createdAt: "2026-08-18T00:00:00Z",
      },
      { passed: false, method: "post-render analysis", findings: ["clipping"] },
    )).toThrow("passing QC");
  });
});
