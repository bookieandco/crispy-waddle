import { describe, expect, it } from "vitest";
import { createRestorationCase } from "./restoration";
import { BasicMasteringAnalyzer, BasicMasteringPlanner, analyzeCaseForMastering } from "./mastering";

describe("mastering analyzer", () => {
  const restorationCase = createRestorationCase({
    id: "case-001",
    userId: "user-001",
    title: "Music Restoration Case #001",
    sourceArtifactId: "artifact-original",
    now: "2026-08-10T00:00:00.000Z",
  });

  it("detects peak risk and preserves the restoration context", () => {
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: restorationCase.id,
      version: restorationCase.versions[0],
      metrics: {
        integratedLufs: -13.3,
        loudnessRangeLu: 2.7,
        truePeakDbtp: -0.2,
        samplePeakDbfs: -0.22,
      },
      restorationAnalysis: {
        id: "analysis-001",
        caseId: "case-001",
        versionId: "case-001:v1",
        createdAt: "2026-08-10T00:00:00.000Z",
        analyzerVersion: "1.0.0",
        source: {
          assetId: "asset-001",
          sampleRateHz: 44100,
          channels: 2,
          durationMs: 180000,
          lossless: false,
        },
        metrics: {},
        issues: [{
          code: "HARSHNESS",
          severity: "medium",
          confidence: 0.85,
          message: "6–11 kHz harshness candidate",
          evidence: { band: "6-11kHz" },
        }],
        recommendations: [],
      },
      now: "2026-08-10T00:00:00.000Z",
    });

    expect(analysis.issues.some((issue) => issue.code === "TRUE_PEAK_RISK")).toBe(true);
    expect(analysis.issues.some((issue) => issue.code === "HARSHNESS")).toBe(true);
    expect(analysis.target.maxTruePeakDbtp).toBe(-1);
  });

  it("creates a conservative plan for Case #001", () => {
    const { analysis, plan } = analyzeCaseForMastering(
      restorationCase,
      {
        integratedLufs: -13.3,
        loudnessRangeLu: 2.7,
        truePeakDbtp: -0.2,
        samplePeakDbfs: -0.22,
      },
      undefined,
      undefined,
      "2026-08-10T00:00:00.000Z",
    );

    expect(analysis.caseId).toBe("case-001");
    expect(plan.sourceVersionId).toBe("case-001:v1");
    expect(plan.safety.preventClipping).toBe(true);
    expect(plan.safety.requirePostAnalysis).toBe(true);
    expect(plan.steps.at(-1)?.operation).toBe("limiter");
  });

  it("does not add aggressive dynamics when loudness range is constrained", () => {
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: "case-001",
      version: restorationCase.versions[0],
      metrics: { integratedLufs: -13.3, loudnessRangeLu: 2.7, truePeakDbtp: -1.5 },
    });
    const plan = new BasicMasteringPlanner().plan(analysis);
    expect(plan.steps.some((step) => step.operation === "multiband")).toBe(false);
  });
});
