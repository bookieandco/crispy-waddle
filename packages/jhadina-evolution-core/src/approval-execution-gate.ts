import type { EvolutionExecutionPlan } from "./evolution-executor";
import type { GovernedRepairRequest, GovernedRepairResult, GovernedRepairService } from "./governed-repair-service";
import type { EvolutionCandidateRepository, StoredEvolutionCandidate } from "./evolution-candidate-repository";
import { sha256 } from "./daily-audit-ledger";

export interface EvolutionApprovalGrant {
  approvalId: string;
  candidateId: string;
  proposalHash: string;
  executionPlanHash: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
}

export interface ApprovalExecutionRequest {
  approval: EvolutionApprovalGrant;
  plan: EvolutionExecutionPlan;
  repair: Omit<GovernedRepairRequest, "plan" | "repairId" | "approvalGranted">;
}

export interface ApprovalExecutionResult {
  approvalId: string;
  candidate: StoredEvolutionCandidate;
  repair: GovernedRepairResult;
}

/**
 * Deterministic release gate between Approval Center decisions and Claude.
 * The candidate repository is the authority for approval state. Execution is
 * additionally bound to the exact candidate proposal and execution plan that
 * the user approved.
 */
export class ApprovalExecutionGate {
  constructor(
    private readonly candidates: EvolutionCandidateRepository,
    private readonly repairService: GovernedRepairService,
  ) {}

  async execute(request: ApprovalExecutionRequest): Promise<ApprovalExecutionResult> {
    const { approval, plan } = request;
    if (!approval.approvalId || !approval.approvedBy) throw new Error("Invalid evolution approval grant");
    if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error("Evolution approval has expired");
    if (approval.candidateId !== plan.id) throw new Error("Approval candidate does not match execution plan");

    const candidate = await this.candidates.get(approval.candidateId);
    if (!candidate) throw new Error(`Unknown evolution candidate: ${approval.candidateId}`);
    if (candidate.decision !== "APPROVED") throw new Error(`Candidate ${candidate.candidateId} is not approved`);
    if (candidate.proposalHash !== approval.proposalHash) throw new Error("Candidate proposal changed after approval");
    if (approval.executionPlanHash !== executionPlanHash(plan)) throw new Error("Execution plan changed after approval");

    const repair = await this.repairService.execute({
      ...request.repair,
      plan,
      repairId: candidate.candidateId,
      approvalGranted: true,
    });

    return { approvalId: approval.approvalId, candidate, repair };
  }
}

export function executionPlanHash(plan: EvolutionExecutionPlan): string {
  return sha256(JSON.stringify({
    id: plan.id,
    title: plan.title,
    risk: plan.risk,
    requiresApproval: plan.requiresApproval,
    allowedPaths: [...plan.allowedPaths].sort(),
    testCommands: [...plan.testCommands],
    securityChecks: [...plan.securityChecks],
  }));
}

export function createApprovalId(candidateId: string, proposalHash: string, executionPlanHashValue: string, approvedAt: string): string {
  return `approval-${sha256(`${candidateId}:${proposalHash}:${executionPlanHashValue}:${approvedAt}`).slice(0, 16)}`;
}
