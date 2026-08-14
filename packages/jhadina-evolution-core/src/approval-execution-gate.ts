import type { EvolutionExecutionPlan, ExecutionRisk } from "./evolution-executor.js";

export interface EvolutionCandidateSnapshot {
  candidateId: string;
  title: string;
  suggestedChange: string;
  risk: ExecutionRisk;
  affectedPaths: string[];
  verificationPlan: string[];
  status: string;
  proposalHash: string;
  decidedBy: string | null;
  decidedAt: string | null;
  executionId: string | null;
}

export interface ApprovedEvolutionExecution {
  candidateId: string;
  approvalId: string;
  plan: EvolutionExecutionPlan;
}

const PROTECTED_PATHS = [
  ".github/workflows/",
  "/identity",
  "/policy",
  "/values",
  "/security",
  "/secrets",
  "/payments",
  "/transfers",
  "/military",
];

function touchesProtectedPath(paths: string[]): boolean {
  return paths.some((path) => {
    const normalized = path.replace(/^\.\//, "");
    return PROTECTED_PATHS.some((protectedPath) =>
      normalized === protectedPath.replace(/^\//, "") ||
      normalized.startsWith(protectedPath.replace(/^\//, "")),
    );
  });
}

/**
 * Authoritative pre-execution boundary. The workflow may supply only an
 * evolution/candidate identifier; all executable instructions must be
 * derived from the approved candidate snapshot.
 */
export class ApprovalExecutionGate {
  approve(
    candidate: EvolutionCandidateSnapshot,
    requestedExecutionId: string,
  ): ApprovedEvolutionExecution {
    if (candidate.status !== "approved") {
      throw new Error(`Evolution candidate ${candidate.candidateId} is not approved.`);
    }
    if (!candidate.decidedBy || !candidate.decidedAt) {
      throw new Error(`Evolution candidate ${candidate.candidateId} has no complete approval receipt.`);
    }
    if (!candidate.proposalHash) {
      throw new Error(`Evolution candidate ${candidate.candidateId} has no proposal hash.`);
    }
    if (candidate.executionId && candidate.executionId !== requestedExecutionId) {
      throw new Error(`Evolution candidate ${candidate.candidateId} is bound to a different execution.`);
    }
    if (candidate.risk === "critical") {
      throw new Error("Critical evolution changes require a separate controlled process.");
    }
    if (touchesProtectedPath(candidate.affectedPaths)) {
      throw new Error("Approved evolution touches a protected Jhadina authority boundary.");
    }

    const plan: EvolutionExecutionPlan = {
      id: candidate.candidateId,
      title: candidate.title,
      risk: candidate.risk,
      requiresApproval: true,
      allowedPaths: [...candidate.affectedPaths],
      testCommands: [...candidate.verificationPlan],
      securityChecks: ["protected-paths", "independent-verification"],
    };

    return {
      candidateId: candidate.candidateId,
      approvalId: `${candidate.candidateId}:${candidate.proposalHash}`,
      plan,
    };
  }
}
