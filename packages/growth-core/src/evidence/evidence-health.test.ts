import { describe, expect, it } from "vitest";
import {
  assessGrowthEvidenceFeedHealth,
  assertGrowthEvidenceHealthyForLearning,
  buildGrowthEvidenceMonitorPlan,
} from "./evidence-health.js";

describe("growth evidence feed health", () => {
  it("allows learning from fresh, monitored, complete lineage", () => {
    const assessment = assessGrowthEvidenceFeedHealth({
      id: "health:meta:1",
      source: "meta+capi+orders",
      assetRef: "experiment:creative-1",
      observedAt: "2026-09-22T18:59:00.000Z",
      checkedAt: "2026-09-22T19:00:00.000Z",
      freshnessSlaSeconds: 600,
      completeness: 0.995,
      monitorCoverage: 0.95,
      activeIncidentCount: 0,
      upstreamIssueCount: 0,
      schemaAnomaly: false,
      volumeAnomaly: false,
      lineageComplete: true,
      evidenceRefs: ["monitor:freshness", "monitor:volume", "lineage:meta-order"],
    });

    expect(assessment.severity).toBe("healthy");
    expect(assessment.allowedForLearning).toBe(true);
    expect(() => assertGrowthEvidenceHealthyForLearning(assessment)).not.toThrow();
  });

  it("blocks learning when freshness or lineage is broken", () => {
    const assessment = assessGrowthEvidenceFeedHealth({
      id: "health:meta:2",
      source: "meta+capi+orders",
      assetRef: "experiment:creative-1",
      observedAt: "2026-09-22T17:00:00.000Z",
      checkedAt: "2026-09-22T19:00:00.000Z",
      freshnessSlaSeconds: 600,
      completeness: 0.99,
      monitorCoverage: 0.95,
      activeIncidentCount: 0,
      upstreamIssueCount: 0,
      schemaAnomaly: false,
      volumeAnomaly: false,
      lineageComplete: false,
      evidenceRefs: ["monitor:freshness", "lineage:gap"],
    });

    expect(assessment.severity).toBe("blocked");
    expect(assessment.blockers).toContain("stale_source");
    expect(assessment.blockers).toContain("lineage_incomplete");
    expect(() => assertGrowthEvidenceHealthyForLearning(assessment)).toThrow(
      /GROWTH_EVIDENCE_NOT_HEALTHY_FOR_LEARNING/,
    );
  });

  it("creates blocking monitor coverage for revenue/conversion truth", () => {
    const plan = buildGrowthEvidenceMonitorPlan({
      assetRef: "growth:meta:attribution",
      criticality: "high",
      carriesRevenueOrConversionTruth: true,
      producedByAgent: false,
    });

    expect(plan.incidentPolicy).toBe("block_learning");
    expect(plan.requirements.find((item) => item.type === "freshness")?.required).toBe(true);
    expect(plan.requirements.find((item) => item.type === "validation")?.required).toBe(true);
    expect(plan.requirements.find((item) => item.type === "lineage")?.required).toBe(true);
  });

  it("adds agent-trace monitoring only when an AI agent produces the evidence", () => {
    const plan = buildGrowthEvidenceMonitorPlan({
      assetRef: "growth:research-agent",
      criticality: "medium",
      carriesRevenueOrConversionTruth: false,
      producedByAgent: true,
    });

    expect(plan.requirements.find((item) => item.type === "agent_trace")?.required).toBe(true);
    expect(plan.incidentPolicy).toBe("degrade_learning");
  });

  it("degrades but does not block when monitoring is partial and an upstream warning exists", () => {
    const assessment = assessGrowthEvidenceFeedHealth({
      id: "health:meta:3",
      source: "meta+capi+orders",
      assetRef: "experiment:creative-1",
      observedAt: "2026-09-22T18:59:00.000Z",
      checkedAt: "2026-09-22T19:00:00.000Z",
      freshnessSlaSeconds: 600,
      completeness: 0.96,
      monitorCoverage: 0.7,
      activeIncidentCount: 0,
      upstreamIssueCount: 1,
      schemaAnomaly: false,
      volumeAnomaly: true,
      lineageComplete: true,
      evidenceRefs: ["monitor:partial", "upstream:warning"],
    });

    expect(assessment.severity).toBe("degraded");
    expect(assessment.allowedForLearning).toBe(true);
    expect(assessment.warnings).toContain("monitor_coverage_partial");
  });
});
