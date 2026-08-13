import type {
  RestorationAnalysis,
  RestorationCase,
  RestorationMetrics,
  RestorationVersion,
} from "./restoration";

export type MasteringTone = "warm" | "balanced" | "open";
export type MasteringIntensity = "transparent" | "moderate" | "assertive";
export type MasteringOperation = "eq" | "multiband" | "saturation" | "stereo" | "limiter";

export interface MasteringAnalysis {
  id: string;
  caseId: string;
  versionId: string;
  createdAt: string;
  analyzerVersion: string;
  metrics: RestorationMetrics;
  issues: MasteringIssue[];
  target: MasteringTarget;
}

export type MasteringIssueCode =
  | "LOW_HEADROOM"
  | "EXCESSIVE_LOUDNESS"
  | "DYNAMIC_CONSTRAINT"
  | "HARSHNESS"
  | "LOW_END"
  | "STEREO_NARROW"
  | "STEREO_WIDE"
  | "TRUE_PEAK_RISK";

export interface MasteringIssue {
  code: MasteringIssueCode;
  severity: "info" | "low" | "medium" | "high";
  confidence: number;
  message: string;
  evidence: Record<string, number | string | boolean>;
}

export interface MasteringTarget {
  tone: MasteringTone;
  intensity: MasteringIntensity;
  targetLufs?: number;
  maxTruePeakDbtp?: number;
}

export interface MasteringStep {
  id: string;
  operation: MasteringOperation;
  priority: number;
  reason: string;
  confidence: number;
  parameters: Record<string, number | string | boolean>;
  requiresApproval: boolean;
}

export interface MasteringPlan {
  id: string;
  caseId: string;
  sourceVersionId: string;
  createdAt: string;
  plannerVersion: string;
  analysisId: string;
  target: MasteringTarget;
  steps: MasteringStep[];
  safety: MasteringSafety;
}

export interface MasteringSafety {
  preserveSource: boolean;
  maxTruePeakDbtp: number;
  maxGainDb: number;
  preventClipping: boolean;
  requirePostAnalysis: boolean;
}

export interface MasteringAnalyzerInput {
  caseId: string;
  version: RestorationVersion;
  restorationAnalysis?: RestorationAnalysis;
  metrics: RestorationMetrics;
  target?: Partial<MasteringTarget>;
  now?: string;
}

export interface MasteringAnalyzer {
  analyze(input: MasteringAnalyzerInput): MasteringAnalysis;
}

export interface MasteringPlanner {
  plan(analysis: MasteringAnalysis, now?: string): MasteringPlan;
}

export const MASTERING_ANALYZER_VERSION = "1.0.0";
export const MASTERING_PLANNER_VERSION = "1.0.0";

const DEFAULT_TARGET: MasteringTarget = {
  tone: "balanced",
  intensity: "transparent",
  targetLufs: -14,
  maxTruePeakDbtp: -1,
};

export class BasicMasteringAnalyzer implements MasteringAnalyzer {
  analyze(input: MasteringAnalyzerInput): MasteringAnalysis {
    const now = input.now ?? new Date().toISOString();
    const target: MasteringTarget = { ...DEFAULT_TARGET, ...input.target };
    const metrics = input.metrics;
    const issues: MasteringIssue[] = [];

    const truePeak = metrics.truePeakDbtp ?? metrics.samplePeakDbfs;
    if (truePeak !== undefined && truePeak > target.maxTruePeakDbtp!) {
      issues.push({
        code: "TRUE_PEAK_RISK",
        severity: "high",
        confidence: 0.95,
        message: "Measured peak exceeds the mastering safety ceiling.",
        evidence: { measuredDbtp: truePeak, ceilingDbtp: target.maxTruePeakDbtp! },
      });
    }

    if (metrics.integratedLufs !== undefined && target.targetLufs !== undefined && metrics.integratedLufs > target.targetLufs + 1) {
      issues.push({
        code: "EXCESSIVE_LOUDNESS",
        severity: "medium",
        confidence: 0.9,
        message: "Source is materially louder than the selected mastering target.",
        evidence: { integratedLufs: metrics.integratedLufs, targetLufs: target.targetLufs },
      });
    }

    if (metrics.loudnessRangeLu !== undefined && metrics.loudnessRangeLu < 4) {
      issues.push({
        code: "DYNAMIC_CONSTRAINT",
        severity: "low",
        confidence: 0.75,
        message: "Low loudness range suggests restrained dynamics; avoid aggressive compression.",
        evidence: { loudnessRangeLu: metrics.loudnessRangeLu },
      });
    }

    const harshness = input.restorationAnalysis?.issues.find((issue) => issue.code === "HARSHNESS");
    if (harshness) {
      issues.push({
        code: "HARSHNESS",
        severity: "medium",
        confidence: harshness.confidence,
        message: "Restoration analysis detected a harshness concern that should remain visible during mastering.",
        evidence: { sourceIssue: harshness.message },
      });
    }

    if (metrics.stereoCorrelation !== undefined && metrics.stereoCorrelation > 0.98) {
      issues.push({
        code: "STEREO_NARROW",
        severity: "low",
        confidence: 0.8,
        message: "Stereo correlation is very high; widening may be considered conservatively.",
        evidence: { stereoCorrelation: metrics.stereoCorrelation },
      });
    }

    return {
      id: `master-analysis_${input.caseId}_${input.version.id}`,
      caseId: input.caseId,
      versionId: input.version.id,
      createdAt: now,
      analyzerVersion: MASTERING_ANALYZER_VERSION,
      metrics,
      issues,
      target,
    };
  }
}

export class BasicMasteringPlanner implements MasteringPlanner {
  plan(analysis: MasteringAnalysis, now = new Date().toISOString()): MasteringPlan {
    const steps: MasteringStep[] = [];
    const truePeak = analysis.metrics.truePeakDbtp ?? analysis.metrics.samplePeakDbfs;

    if (truePeak !== undefined && truePeak > analysis.target.maxTruePeakDbtp!) {
      steps.push({
        id: "master-step-gain",
        operation: "eq",
        priority: 1,
        reason: "Create safe headroom before downstream mastering stages.",
        confidence: 0.95,
        parameters: { gainDb: analysis.target.maxTruePeakDbtp! - truePeak },
        requiresApproval: false,
      });
    }

    if (analysis.issues.some((issue) => issue.code === "HARSHNESS")) {
      steps.push({
        id: "master-step-presence",
        operation: "eq",
        priority: 2,
        reason: "Preserve the restoration finding while applying only a restrained presence correction.",
        confidence: 0.8,
        parameters: { frequencyHz: 7800, gainDb: -0.75, q: 1.2 },
        requiresApproval: true,
      });
    }

    if (analysis.metrics.loudnessRangeLu === undefined || analysis.metrics.loudnessRangeLu >= 4) {
      steps.push({
        id: "master-step-dynamics",
        operation: "multiband",
        priority: 3,
        reason: "Use restrained dynamic control only after tonal correction and headroom staging.",
        confidence: 0.65,
        parameters: { maxGainReductionDb: 1.5, ratio: 1.2 },
        requiresApproval: true,
      });
    }

    steps.push({
      id: "master-step-limiter",
      operation: "limiter",
      priority: 99,
      reason: "Set the final true-peak ceiling without treating loudness as the sole quality metric.",
      confidence: 0.95,
      parameters: { ceilingDbtp: analysis.target.maxTruePeakDbtp!, targetLufs: analysis.target.targetLufs ?? -14 },
      requiresApproval: true,
    });

    return {
      id: `master-plan_${analysis.caseId}_${analysis.versionId}`,
      caseId: analysis.caseId,
      sourceVersionId: analysis.versionId,
      createdAt: now,
      plannerVersion: MASTERING_PLANNER_VERSION,
      analysisId: analysis.id,
      target: analysis.target,
      steps,
      safety: {
        preserveSource: true,
        maxTruePeakDbtp: analysis.target.maxTruePeakDbtp!,
        maxGainDb: 6,
        preventClipping: true,
        requirePostAnalysis: true,
      },
    };
  }
}

export function analyzeCaseForMastering(
  restorationCase: RestorationCase,
  metrics: RestorationMetrics,
  restorationAnalysis?: RestorationAnalysis,
  target?: Partial<MasteringTarget>,
  now?: string,
): { analysis: MasteringAnalysis; plan: MasteringPlan } {
  const version = restorationCase.versions.find((candidate) => candidate.id === restorationCase.currentVersionId);
  if (!version) throw new Error("Current restoration version not found");

  const analyzer = new BasicMasteringAnalyzer();
  const analysis = analyzer.analyze({
    caseId: restorationCase.id,
    version,
    restorationAnalysis,
    metrics,
    target,
    now,
  });

  return {
    analysis,
    plan: new BasicMasteringPlanner().plan(analysis, now),
  };
}
