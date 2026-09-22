import type { GrowthId, ISODateTime } from "../domain/types.js";

export type EvidenceHealthSeverity = "healthy" | "degraded" | "blocked";

export interface GrowthEvidenceFeedHealthInput {
  id: GrowthId;
  source: string;
  assetRef: string;
  observedAt: ISODateTime;
  checkedAt: ISODateTime;
  freshnessSlaSeconds: number;
  completeness: number;
  monitorCoverage: number;
  activeIncidentCount: number;
  upstreamIssueCount: number;
  schemaAnomaly: boolean;
  volumeAnomaly: boolean;
  lineageComplete: boolean;
  evidenceRefs: readonly string[];
}

export interface GrowthEvidenceFeedHealthAssessment {
  id: GrowthId;
  source: string;
  assetRef: string;
  checkedAt: ISODateTime;
  ageSeconds: number;
  freshness: "fresh" | "stale";
  completeness: number;
  monitorCoverage: number;
  activeIncidentCount: number;
  upstreamIssueCount: number;
  schemaAnomaly: boolean;
  volumeAnomaly: boolean;
  lineageComplete: boolean;
  severity: EvidenceHealthSeverity;
  allowedForLearning: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  evidenceRefs: readonly string[];
}

export function assessGrowthEvidenceFeedHealth(
  input: GrowthEvidenceFeedHealthInput,
): GrowthEvidenceFeedHealthAssessment {
  if (!input.id.trim() || !input.source.trim() || !input.assetRef.trim()) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_ID_REQUIRED");
  }
  const observed = Date.parse(input.observedAt);
  const checked = Date.parse(input.checkedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(checked) || checked < observed) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_TIME_INVALID");
  }
  if (!Number.isFinite(input.freshnessSlaSeconds) || input.freshnessSlaSeconds <= 0) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_SLA_INVALID");
  }
  if (
    !Number.isFinite(input.completeness) || input.completeness < 0 || input.completeness > 1
    || !Number.isFinite(input.monitorCoverage) || input.monitorCoverage < 0 || input.monitorCoverage > 1
  ) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_SCORE_INVALID");
  }
  if (
    !Number.isInteger(input.activeIncidentCount) || input.activeIncidentCount < 0
    || !Number.isInteger(input.upstreamIssueCount) || input.upstreamIssueCount < 0
  ) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_COUNT_INVALID");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("GROWTH_EVIDENCE_HEALTH_EVIDENCE_REQUIRED");
  }

  const ageSeconds = Math.max(0, Math.floor((checked - observed) / 1000));
  const freshness = ageSeconds <= input.freshnessSlaSeconds ? "fresh" : "stale";
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (freshness === "stale") blockers.push("stale_source");
  if (!input.lineageComplete) blockers.push("lineage_incomplete");
  if (input.activeIncidentCount > 0) blockers.push("active_incident");
  if (input.schemaAnomaly) blockers.push("schema_anomaly");

  if (input.completeness < 0.9) blockers.push("completeness_below_learning_floor");
  else if (input.completeness < 0.98) warnings.push("completeness_below_target");

  if (input.monitorCoverage < 0.5) blockers.push("monitor_coverage_insufficient");
  else if (input.monitorCoverage < 0.8) warnings.push("monitor_coverage_partial");

  if (input.upstreamIssueCount > 0) warnings.push("upstream_issues_present");
  if (input.volumeAnomaly) warnings.push("volume_anomaly_present");

  const severity: EvidenceHealthSeverity =
    blockers.length > 0 ? "blocked"
      : warnings.length > 0 ? "degraded"
      : "healthy";

  return Object.freeze({
    id: input.id,
    source: input.source,
    assetRef: input.assetRef,
    checkedAt: input.checkedAt,
    ageSeconds,
    freshness,
    completeness: input.completeness,
    monitorCoverage: input.monitorCoverage,
    activeIncidentCount: input.activeIncidentCount,
    upstreamIssueCount: input.upstreamIssueCount,
    schemaAnomaly: input.schemaAnomaly,
    volumeAnomaly: input.volumeAnomaly,
    lineageComplete: input.lineageComplete,
    severity,
    allowedForLearning: severity !== "blocked",
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
  });
}

export function assertGrowthEvidenceHealthyForLearning(
  assessment: GrowthEvidenceFeedHealthAssessment,
): void {
  if (!assessment.allowedForLearning || assessment.severity === "blocked") {
    throw new Error(
      `GROWTH_EVIDENCE_NOT_HEALTHY_FOR_LEARNING:${assessment.blockers.join(",") || "blocked"}`,
    );
  }
}


export type GrowthEvidenceMonitorType =
  | "freshness"
  | "volume"
  | "schema"
  | "validation"
  | "lineage"
  | "agent_trace";

export interface GrowthEvidenceMonitorRequirement {
  type: GrowthEvidenceMonitorType;
  required: boolean;
  rationale: string;
}

export interface GrowthEvidenceMonitorPlan {
  assetRef: string;
  criticality: "low" | "medium" | "high";
  requirements: readonly GrowthEvidenceMonitorRequirement[];
  incidentPolicy: "observe" | "degrade_learning" | "block_learning";
}

export function buildGrowthEvidenceMonitorPlan(input: {
  assetRef: string;
  criticality: "low" | "medium" | "high";
  carriesRevenueOrConversionTruth: boolean;
  producedByAgent?: boolean;
}): GrowthEvidenceMonitorPlan {
  if (!input.assetRef.trim()) throw new Error("GROWTH_EVIDENCE_MONITOR_ASSET_REQUIRED");

  const requirements: GrowthEvidenceMonitorRequirement[] = [
    {
      type: "freshness",
      required: input.criticality !== "low" || input.carriesRevenueOrConversionTruth,
      rationale: "Prevent stale delivery, attribution, conversion, or economic data from driving decisions.",
    },
    {
      type: "volume",
      required: input.criticality !== "low",
      rationale: "Detect drops/spikes that can bias rates, attribution, and experiment outcomes.",
    },
    {
      type: "schema",
      required: true,
      rationale: "Detect field/contract changes before downstream learning silently misreads data.",
    },
    {
      type: "validation",
      required: input.carriesRevenueOrConversionTruth,
      rationale: "Validate required identifiers, amounts, event semantics, and conversion fields.",
    },
    {
      type: "lineage",
      required: input.criticality === "high" || input.carriesRevenueOrConversionTruth,
      rationale: "Preserve upstream/downstream provenance and blast-radius analysis.",
    },
    {
      type: "agent_trace",
      required: input.producedByAgent === true,
      rationale: "Observe agent trajectory, latency, errors, and validation outcomes when AI produces the data.",
    },
  ];

  return Object.freeze({
    assetRef: input.assetRef,
    criticality: input.criticality,
    requirements: Object.freeze(requirements.map((item) => Object.freeze(item))),
    incidentPolicy:
      input.criticality === "high" || input.carriesRevenueOrConversionTruth
        ? "block_learning"
        : input.criticality === "medium"
          ? "degrade_learning"
          : "observe",
  });
}
