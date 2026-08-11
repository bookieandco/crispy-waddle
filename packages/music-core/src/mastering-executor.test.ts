import { describe, expect, it } from "vitest";
import { createRestorationCase } from "./restoration";
import { BasicMasteringAnalyzer, BasicMasteringPlanner } from "./mastering";
import { executeMasteringPlan } from "./mastering-executor";

describe("mastering execution boundary", () => {
  it("requires explicit policy approval", () => {
    const restorationCase = createRestorationCase({ id: "case-001", userId: "user-001", title: "Case #001", sourceArtifactId: "source" });
    const version = restorationCase.versions[0];
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: restorationCase.id,
      version,
      metrics: { truePeakDbtp: -0.2, integratedLufs: -13.3, loudnessRangeLu: 2.7 },
    });
    const plan = new BasicMasteringPlanner().plan(analysis);

    expect(() => executeMasteringPlan({
      plan,
      sourceVersion: version,
      source: { id: "source", samples: new Float32Array([0.9, -0.9]), sampleRateHz: 44100, channels: 2 },
      policy: { approved: false, maxGainDb: 6, maxTruePeakDbtp: -1 },
    })).toThrow(/approval/);
  });

  it("creates a candidate artifact without mutating the source", () => {
    const restorationCase = createRestorationCase({ id: "case-001", userId: "user-001", title: "Case #001", sourceArtifactId: "source" });
    const version = restorationCase.versions[0];
    const sourceSamples = new Float32Array([0.9, -0.9, 0.25, -0.25]);
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: restorationCase.id,
      version,
      metrics: { truePeakDbtp: -0.2, integratedLufs: -13.3, loudnessRangeLu: 2.7 },
    });
    const plan = new BasicMasteringPlanner().plan(analysis);
    const result = executeMasteringPlan({
      plan,
      sourceVersion: version,
      source: { id: "source", samples: sourceSamples, sampleRateHz: 44100, channels: 2 },
      policy: { approved: true, maxGainDb: 6, maxTruePeakDbtp: -1 },
    });

    expect(result.status).toBe("candidate");
    expect(result.artifact.id).toContain("source:mastering:");
    expect(result.artifact.samples).not.toBe(sourceSamples);
    expect(Array.from(sourceSamples)).toEqual([0.9, -0.9, 0.25, -0.25]);
    expect(result.metricsAfter.samplePeakDbfs).toBeLessThanOrEqual(-1);
  });

  it("rejects a plan aimed at another restoration version", () => {
    const restorationCase = createRestorationCase({ id: "case-001", userId: "user-001", title: "Case #001", sourceArtifactId: "source" });
    const version = restorationCase.versions[0];
    const analysis = new BasicMasteringAnalyzer().analyze({ caseId: restorationCase.id, version, metrics: {} });
    const plan = new BasicMasteringPlanner().plan(analysis);

    expect(() => executeMasteringPlan({
      plan: { ...plan, sourceVersionId: "case-001:v999" },
      sourceVersion: version,
      source: { id: "source", samples: new Float32Array([0.1]), sampleRateHz: 44100, channels: 1 },
      policy: { approved: true, maxGainDb: 6, maxTruePeakDbtp: -1 },
    })).toThrow(/does not target/);
  });
});
