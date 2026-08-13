import type { MasteringExecutionResult } from "./mastering-executor";
import type { MasteringPlan } from "./mastering";
import type { RestorationMetrics, RestorationVersion } from "./restoration";

export type QcVerdict = "pass" | "reject";
export type QcSeverity = "info" | "warning" | "error";

export interface PostMasterAnalysis {
  id: string;
  caseId: string;
  parentVersionId: string;
  artifactId: string;
  createdAt: string;
  metricsBefore: RestorationMetrics;
  metricsAfter: RestorationMetrics;
  checks: QcCheck[];
}

export interface QcCheck {
  code: "PEAK_CEILING" | "FINITE_AUDIO" | "SOURCE_PRESERVED" | "GAIN_LIMIT" | "EXECUTION_COMPLETE";
  severity: QcSeverity;
  passed: boolean;
  message: string;
  evidence: Record<string, number | string | boolean>;
}

export interface PostMasterQcResult {
  analysis: PostMasterAnalysis;
  verdict: QcVerdict;
  reasons: string[];
}

export interface RestorationVersionCommit {
  version: RestorationVersion;
  qc: PostMasterQcResult;
}

export interface PostMasterQcPolicy {
  maxTruePeakDbtp: number;
  maxGainDb: number;
  requireExecution: boolean;
  requireSourcePreservation: boolean;
}

export const POST_MASTER_ANALYZER_VERSION = "1.0.0";

export function analyzePostMaster(
  execution: MasteringExecutionResult,
  plan: MasteringPlan,
  sourceVersion: RestorationVersion,
  now = new Date().toISOString(),
  policy: PostMasterQcPolicy = {
    maxTruePeakDbtp: plan.safety.maxTruePeakDbtp,
    maxGainDb: plan.safety.maxGainDb,
    requireExecution: true,
    requireSourcePreservation: true,
  },
): PostMasterQcResult {
  const afterPeak = execution.metricsAfter.truePeakDbtp ?? execution.metricsAfter.samplePeakDbfs ?? -Infinity;
  const beforePeak = execution.metricsBefore.truePeakDbtp ?? execution.metricsBefore.samplePeakDbfs ?? -Infinity;
  const checks: QcCheck[] = [];

  checks.push({
    code: "PEAK_CEILING",
    severity: "error",
    passed: afterPeak <= policy.maxTruePeakDbtp + 0.001,
    message: afterPeak <= policy.maxTruePeakDbtp + 0.001 ? "True-peak ceiling satisfied." : "True-peak ceiling exceeded.",
    evidence: { afterPeakDbtp: afterPeak, maxTruePeakDbtp: policy.maxTruePeakDbtp },
  });

  checks.push({
    code: "FINITE_AUDIO",
    severity: "error",
    passed: execution.artifact.samples.every(Number.isFinite),
    message: "Output contains only finite samples.",
    evidence: { sampleCount: execution.artifact.samples.length },
  });

  checks.push({
    code: "SOURCE_PRESERVED",
    severity: "error",
    passed: !policy.requireSourcePreservation || execution.artifact.id !== sourceVersion.outputArtifactId,
    message: "Candidate is represented as a new artifact rather than overwriting the source artifact.",
    evidence: { sourceArtifactId: sourceVersion.outputArtifactId, candidateArtifactId: execution.artifact.id },
  });

  const maxObservedGain = Math.abs(afterPeak - beforePeak);
  checks.push({
    code: "GAIN_LIMIT",
    severity: "error",
    passed: maxObservedGain <= policy.maxGainDb + 0.001,
    message: maxObservedGain <= policy.maxGainDb + 0.001 ? "Observed peak change is within policy." : "Observed peak change exceeds policy.",
    evidence: { beforePeakDbfs: beforePeak, afterPeakDbfs: afterPeak, maxGainDb: policy.maxGainDb },
  });

  checks.push({
    code: "EXECUTION_COMPLETE",
    severity: "error",
    passed: !policy.requireExecution || execution.status === "candidate",
    message: execution.status === "candidate" ? "Execution produced a candidate artifact." : "Execution did not produce an acceptable candidate.",
    evidence: { executionStatus: execution.status, executedSteps: execution.executedSteps.length },
  });

  const failed = checks.filter((check) => !check.passed);
  const verdict: QcVerdict = failed.length === 0 ? "pass" : "reject";
  const reasons = failed.map((check) => check.message);

  return {
    analysis: {
      id: `post-master_${sourceVersion.caseId}_${sourceVersion.id}`,
      caseId: sourceVersion.caseId,
      parentVersionId: sourceVersion.id,
      artifactId: execution.artifact.id,
      createdAt: now,
      metricsBefore: execution.metricsBefore,
      metricsAfter: execution.metricsAfter,
      checks,
    },
    verdict,
    reasons,
  };
}

export function commitMasteringCandidate(
  sourceVersion: RestorationVersion,
  execution: MasteringExecutionResult,
  qc: PostMasterQcResult,
  now = new Date().toISOString(),
): RestorationVersionCommit {
  const version: RestorationVersion = {
    id: `${sourceVersion.caseId}:v${Date.parse(now)}`,
    caseId: sourceVersion.caseId,
    parentVersionId: sourceVersion.id,
    createdAt: now,
    label: "Mastering candidate",
    status: qc.verdict === "pass" ? "qc-passed" : "rejected",
    operation: "master",
    parameters: {
      qcVerdict: qc.verdict,
      executedSteps: execution.executedSteps.length,
    },
    inputArtifactId: sourceVersion.outputArtifactId,
    outputArtifactId: execution.artifact.id,
    metricsBefore: execution.metricsBefore,
    metricsAfter: execution.metricsAfter,
  };

  return { version, qc };
}
