export type RestorationCaseStatus =
  | "open"
  | "analyzing"
  | "planned"
  | "processing"
  | "qc"
  | "approved"
  | "rejected";

export type RestorationSeverity = "info" | "low" | "medium" | "high" | "critical";

export type RestorationIssueCode =
  | "SOURCE_CODEC"
  | "CLIPPING"
  | "LOW_HEADROOM"
  | "HARSHNESS"
  | "LOW_END_IMBALANCE"
  | "DYNAMIC_COLLAPSE"
  | "NOISE_FLOOR"
  | "STEREO_IMBALANCE"
  | "LOSSY_SOURCE";

export interface AudioSourceFingerprint {
  assetId: string;
  sha256?: string;
  mimeType?: string;
  codec?: string;
  bitrate?: number;
  sampleRateHz: number;
  bitDepth?: number;
  channels: number;
  durationMs: number;
  lossless: boolean;
}

export interface RestorationMetrics {
  integratedLufs?: number;
  loudnessRangeLu?: number;
  truePeakDbtp?: number;
  samplePeakDbfs?: number;
  crestFactorDb?: number;
  dcOffsetDbfs?: number;
  estimatedNoiseFloorDbfs?: number;
  stereoCorrelation?: number;
  spectralCentroidHz?: number;
  bandEnergyDb?: Record<string, number>;
}

export interface RestorationIssue {
  code: RestorationIssueCode;
  severity: RestorationSeverity;
  confidence: number;
  message: string;
  evidence: Record<string, number | string | boolean>;
}

export interface RestorationAnalysis {
  id: string;
  caseId: string;
  versionId: string;
  createdAt: string;
  analyzerVersion: string;
  source: AudioSourceFingerprint;
  metrics: RestorationMetrics;
  issues: RestorationIssue[];
  recommendations: RestorationRecommendation[];
}

export type RestorationOperation =
  | "gain"
  | "declick"
  | "declip"
  | "denoise"
  | "spectral-repair"
  | "eq"
  | "dynamics"
  | "stereo"
  | "separate"
  | "reconstruct"
  | "master";

export interface RestorationRecommendation {
  operation: RestorationOperation;
  reason: string;
  priority: number;
  confidence: number;
  parameters: Record<string, number | string | boolean>;
  requiresApproval: boolean;
}

export interface RestorationVersion {
  id: string;
  caseId: string;
  parentVersionId?: string;
  createdAt: string;
  label: string;
  status: "source" | "candidate" | "qc-passed" | "approved" | "rejected";
  operation?: RestorationOperation;
  parameters?: Record<string, number | string | boolean>;
  inputArtifactId: string;
  outputArtifactId: string;
  metricsBefore?: RestorationMetrics;
  metricsAfter?: RestorationMetrics;
}

export interface RestorationCase {
  id: string;
  userId: string;
  title: string;
  status: RestorationCaseStatus;
  createdAt: string;
  updatedAt: string;
  sourceVersionId: string;
  currentVersionId: string;
  versions: RestorationVersion[];
  analyses: RestorationAnalysis[];
}

export interface RestorationAnalyzerInput {
  caseId: string;
  versionId: string;
  source: AudioSourceFingerprint;
  samples?: Float32Array;
  sampleRateHz?: number;
  channels?: number;
  now?: string;
}

export interface RestorationAnalyzer {
  analyze(input: RestorationAnalyzerInput): RestorationAnalysis;
}

export const RESTORATION_ANALYZER_VERSION = "1.0.0";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class BasicRestorationAnalyzer implements RestorationAnalyzer {
  analyze(input: RestorationAnalyzerInput): RestorationAnalysis {
    const now = input.now ?? new Date().toISOString();
    const sampleRate = input.sampleRateHz ?? input.source.sampleRateHz;
    const samples = input.samples;
    const metrics: RestorationMetrics = {};

    if (samples?.length) {
      let sum = 0;
      let peak = 0;
      let sumSquares = 0;
      for (const sample of samples) {
        const value = Number.isFinite(sample) ? sample : 0;
        const abs = Math.abs(value);
        sum += value;
        sumSquares += value * value;
        peak = Math.max(peak, abs);
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      metrics.samplePeakDbfs = dbfs(peak);
      metrics.crestFactorDb = rms > 0 ? dbfs(peak / rms) : undefined;
      metrics.dcOffsetDbfs = dbfs(Math.abs(sum / samples.length));
    }

    const issues: RestorationIssue[] = [];
    if (!input.source.lossless) {
      issues.push({
        code: "LOSSY_SOURCE",
        severity: "info",
        confidence: 1,
        message: "Source is lossy; restoration must preserve the source artifact and avoid unnecessary re-encoding.",
        evidence: { codec: input.source.codec ?? "unknown", bitrate: input.source.bitrate ?? 0 },
      });
    }

    if ((metrics.samplePeakDbfs ?? -Infinity) > -0.1) {
      issues.push({
        code: "LOW_HEADROOM",
        severity: "medium",
        confidence: 0.95,
        message: "Source has very little sample peak headroom.",
        evidence: { samplePeakDbfs: metrics.samplePeakDbfs ?? 0 },
      });
    }

    const recommendations: RestorationRecommendation[] = [];
    if ((metrics.samplePeakDbfs ?? -Infinity) > -0.1) {
      recommendations.push({
        operation: "gain",
        reason: "Create processing headroom before corrective DSP; do not normalize the source destructively.",
        priority: 1,
        confidence: 0.95,
        parameters: { targetPeakDbfs: -1 },
        requiresApproval: false,
      });
    }

    return {
      id: `analysis_${input.caseId}_${input.versionId}`,
      caseId: input.caseId,
      versionId: input.versionId,
      createdAt: now,
      analyzerVersion: RESTORATION_ANALYZER_VERSION,
      source: input.source,
      metrics: { ...metrics, spectralCentroidHz: sampleRate > 0 ? undefined : undefined },
      issues,
      recommendations,
    };
  }
}

export function createRestorationCase(args: {
  id: string;
  userId: string;
  title: string;
  sourceArtifactId: string;
  now?: string;
}): RestorationCase {
  const now = args.now ?? new Date().toISOString();
  const sourceVersionId = `${args.id}:v1`;
  const sourceVersion: RestorationVersion = {
    id: sourceVersionId,
    caseId: args.id,
    createdAt: now,
    label: "Original source",
    status: "source",
    inputArtifactId: args.sourceArtifactId,
    outputArtifactId: args.sourceArtifactId,
  };

  return {
    id: args.id,
    userId: args.userId,
    title: args.title,
    status: "open",
    createdAt: now,
    updatedAt: now,
    sourceVersionId,
    currentVersionId: sourceVersionId,
    versions: [sourceVersion],
    analyses: [],
  };
}

export function appendRestorationVersion(
  restorationCase: RestorationCase,
  version: RestorationVersion,
): RestorationCase {
  if (version.caseId !== restorationCase.id) throw new Error("Version belongs to a different restoration case");
  if (version.parentVersionId !== restorationCase.currentVersionId) {
    throw new Error("Restoration version must descend from the current version");
  }
  return {
    ...restorationCase,
    status: "processing",
    updatedAt: version.createdAt,
    currentVersionId: version.id,
    versions: [...restorationCase.versions, version],
  };
}

function dbfs(amplitude: number): number {
  if (amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

export function confidenceFromSignal(signal: number, threshold: number): number {
  return clamp01(Math.abs(signal) / Math.max(Math.abs(threshold), Number.EPSILON));
}
