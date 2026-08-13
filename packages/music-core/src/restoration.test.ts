import { describe, expect, it } from "vitest";
import {
  BasicRestorationAnalyzer,
  appendRestorationVersion,
  createRestorationCase,
} from "./restoration";

const source = {
  assetId: "asset-001",
  mimeType: "audio/mpeg",
  codec: "mp3",
  bitrate: 272000,
  sampleRateHz: 44100,
  channels: 2,
  durationMs: 180000,
  lossless: false,
};

describe("restoration case", () => {
  it("creates an immutable source version", () => {
    const restorationCase = createRestorationCase({
      id: "case-001",
      userId: "user-001",
      title: "Music Restoration Case #001",
      sourceArtifactId: "artifact-original",
      now: "2026-08-10T00:00:00.000Z",
    });

    expect(restorationCase.sourceVersionId).toBe("case-001:v1");
    expect(restorationCase.currentVersionId).toBe("case-001:v1");
    expect(restorationCase.versions).toHaveLength(1);
    expect(restorationCase.versions[0].outputArtifactId).toBe("artifact-original");
  });

  it("rejects a version that does not descend from current", () => {
    const restorationCase = createRestorationCase({
      id: "case-001",
      userId: "user-001",
      title: "Case",
      sourceArtifactId: "artifact-original",
    });

    expect(() => appendRestorationVersion(restorationCase, {
      id: "case-001:v2",
      caseId: "case-001",
      parentVersionId: "wrong-parent",
      createdAt: "2026-08-10T00:00:01.000Z",
      label: "Candidate",
      status: "candidate",
      operation: "gain",
      inputArtifactId: "artifact-original",
      outputArtifactId: "artifact-candidate",
    })).toThrow(/current version/);
  });
});

describe("basic restoration analyzer", () => {
  it("flags a lossy source and low headroom without applying DSP", () => {
    const analyzer = new BasicRestorationAnalyzer();
    // Peak must clear the analyzer's LOW_HEADROOM threshold (samplePeakDbfs > -0.1dB,
    // i.e. peak > ~0.9885) for this fixture to actually exercise that flag.
    const samples = new Float32Array([0.99, -0.9, 0.2, -0.1]);
    const analysis = analyzer.analyze({
      caseId: "case-001",
      versionId: "case-001:v1",
      source,
      samples,
      now: "2026-08-10T00:00:00.000Z",
    });

    expect(analysis.analyzerVersion).toBe("1.0.0");
    expect(analysis.metrics.samplePeakDbfs).toBeGreaterThan(-0.2);
    expect(analysis.issues.some((issue) => issue.code === "LOSSY_SOURCE")).toBe(true);
    expect(analysis.issues.some((issue) => issue.code === "LOW_HEADROOM")).toBe(true);
    expect(analysis.recommendations[0]?.operation).toBe("gain");
  });
});
