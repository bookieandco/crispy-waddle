import type { MasteringAnalysis, MasteringPlan, MasteringTarget } from "./mastering";
import { BasicMasteringAnalyzer, BasicMasteringPlanner } from "./mastering";
import type { RestorationAnalysis, RestorationCase, RestorationMetrics } from "./restoration";
import type { PostMasterQcResult } from "./post-master-qc";

export type IntelligenceDecision = "observe" | "propose" | "approve-required" | "reject";

export interface MusicIntelligenceContext {
  case: RestorationCase;
  restorationAnalysis?: RestorationAnalysis;
  masteringAnalysis?: MasteringAnalysis;
  masteringPlan?: MasteringPlan;
  qc?: PostMasterQcResult;
  metrics?: RestorationMetrics;
}

export interface MusicIntelligenceDecision {
  decision: IntelligenceDecision;
  summary: string;
  reasons: string[];
  evidence: Record<string, number | string | boolean>;
  requiresUserApproval: boolean;
}

export interface MusicIntelligenceBridge {
  assess(context: MusicIntelligenceContext): MusicIntelligenceDecision;
  createMasteringPlan(context: MusicIntelligenceContext, target?: Partial<MasteringTarget>): MasteringPlan;
}

export class DeterministicMusicIntelligenceBridge implements MusicIntelligenceBridge {
  assess(context: MusicIntelligenceContext): MusicIntelligenceDecision {
    if (context.qc?.verdict === "reject") {
      return {
        decision: "reject",
        summary: "Candidate rejected by deterministic audio QC.",
        reasons: context.qc.reasons,
        evidence: { qcVerdict: "reject" },
        requiresUserApproval: false,
      };
    }

    if (context.qc?.verdict === "pass") {
      return {
        decision: "approve-required",
        summary: "Candidate passed deterministic QC and is ready for user approval.",
        reasons: ["All required post-master QC checks passed."],
        evidence: { qcVerdict: "pass" },
        requiresUserApproval: true,
      };
    }

    if (context.masteringPlan) {
      return {
        decision: context.masteringPlan.steps.some((step) => step.requiresApproval) ? "approve-required" : "propose",
        summary: "Mastering plan is ready for controlled execution.",
        reasons: context.masteringPlan.steps.map((step) => step.reason),
        evidence: { stepCount: context.masteringPlan.steps.length },
        requiresUserApproval: context.masteringPlan.steps.some((step) => step.requiresApproval),
      };
    }

    return {
      decision: "observe",
      summary: "More analysis is required before Jhadina can propose processing.",
      reasons: ["No mastering plan or QC result is present."],
      evidence: { caseId: context.case.id },
      requiresUserApproval: false,
    };
  }

  createMasteringPlan(context: MusicIntelligenceContext, target?: Partial<MasteringTarget>): MasteringPlan {
    const version = context.case.versions.find((candidate) => candidate.id === context.case.currentVersionId);
    if (!version) throw new Error("Current restoration version not found");
    const analysis = new BasicMasteringAnalyzer().analyze({
      caseId: context.case.id,
      version,
      restorationAnalysis: context.restorationAnalysis,
      metrics: context.metrics ?? context.restorationAnalysis?.metrics ?? {},
      target,
    });
    return new BasicMasteringPlanner().plan(analysis);
  }
}
