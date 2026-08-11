import { describe, expect, it } from "vitest";
import { createRestorationCase } from "./restoration";
import { BasicMasteringAnalyzer, BasicMasteringPlanner } from "./mastering";
import { executeMasteringPlan } from "./mastering-executor";
import { analyzePostMaster, commitMasteringCandidate } from "./post-master-qc";

describe("post-master QC", () => {
  it("passes a safe Case #001 candidate and creates a child version", () => {
    const restorationCase = createRestorationCase({ id: "case-001", userId: "user-001", title: "Case #001", sourceArtifactId: "source" });
    const sourceVersion = restorationCase.versions[0];
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: restorationCase.id,
      version: sourceVersion,
      metrics: { truePeakDbtp: -0.2, integratedLufs: -13.3, loudnessRangeLu: 2.7 },
    });
    const plan = new BasicMasteringPlanner().plan(analysis);
    const execution = executeMasteringPlan({
      plan,
      sourceVersion,
      source: { id: "source", samples: new Float32Array([0.9, -0.9]), sampleRateHz: 44100, channels: 2 },
      policy: { approved: true, maxGainDb: 6, maxTruePeakDbtp: -1 },
    });
    const qc = analyzePostMaster(execution, plan, sourceVersion);
    const committed = commitMasteringCandidate(sourceVersion, execution, qc);

    expect(qc.verdict).toBe("pass");
    expect(committed.version.parentVersionId).toBe(sourceVersion.id);
    expect(committed.version.status).toBe("qc-passed");
    expect(committed.version.outputArtifactId).toBe(execution.artifact.id);
    expect(committed.version.metricsBefore).toEqual(execution.metricsBefore);
    expect(committed.version.metricsAfter).toEqual(execution.metricsAfter);
  });

  it("rejects an execution whose final peak violates the QC ceiling", () => {
    const restorationCase = createRestorationCase({ id: "case-001", userId: "user-001", title: "Case #001", sourceArtifactId: "source" });
    const sourceVersion = restorationCase.versions[0];
    const analysis = new BasicMasteringAnalyzer().analyze({ caseId: restorationCase.id, version: sourceVersion, metrics: {} });
    const plan = new BasicMasteringPlanner().plan(analysis);
    const execution = {
      artifact: { id: "candidate", samples: new Float32Array([0.99]), sampleRateHz: 44100, channels: 1 },
      parentVersionId: sourceVersion.id,
      metricsBefore: { samplePeakDbfs: -6 },
      metricsAfter: { samplePeakDbfs: -0.08 },
      executedSteps: [],
      status: "candidate" as const,
      warnings: [],
    };
    const qc = analyzePostMaster(execution, plan, sourceVersion);
    expect(qc.verdict).toBe("reject");
    expect(qc.reasons.length).toBeGreaterThan(0);
    expect(commitMasteringCandidate(sourceVersion, execution, qc).version.status).toBe("rejected");
  });
});
