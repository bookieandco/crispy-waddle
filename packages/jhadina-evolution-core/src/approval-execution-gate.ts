import type { EvolutionExecutionPlan } from "./evolution-executor";
import type { GovernedRepairRequest, GovernedRepairResult, GovernedRepairService } from "./governed-repair-service";
import type { EvolutionCandidateRepository, StoredEvolutionCandidate } from "./evolution-candidate-repository";
import { sha256 } from "./daily-audit-ledger";

export interface EvolutionApprovalGrant {
  approvalId: string;
  candidateId: string;
  proposalHash: string;
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
 * The candidate repository is the authority for the approval state; this gate
 * additionally binds execution to the exact proposal hash approved by the user.
 */
export class ApprovalExecutionGate {
  constructor(
    private readonly candidates: EvolutionCandidateRepository,
    private readonly repairService: GovernedRepairService,
  ) {}

  async execute(request: ApprovalExecutionRequest): Promise<ApprovalExecutionResult> {
    const { approval, plan } = request;
    const now = Date.now();

    if (!approval.approvalId) throw new Error("approvalId is required");
    if (!approval.approvedBy) throw new Error("approvedBy is required");
    if (Date.parse(approval.expiresAt) <= now) throw new Error("Evolution approval has expired");
    if (approval.candidateId !== plan.id) throw new Error("Approval candidate does not match execution plan");
    if (approval.proposalHash !== planProposalHash(plan, approval.candidateId)) {
      throw new Error("Evolution proposal hash does not match the approved plan");
    }

    const candidate = await this.candidates.get(approval.candidateId);
    if (!candidate) throw new Error(`Unknown evolution candidate: ${approval.candidateId}`);
    if (candidate.decision !== "APPROVED") throw new Error(`Candidate ${candidate.candidateId} is not approved`);
    if (candidate.proposalHash !== approval.proposalHash) throw new Error("Candidate proposal changed after approval");

    const repair = await this.repairService.execute({
      ...request.repair,
      plan,
      repairId: candidate.candidateId,
      approvalGranted: true,
    });

    return { approvalId: approval.approvalId, candidate, repair };
  }
}

export function planProposalHash(plan: EvolutionExecutionPlan, candidateId: string): string {
  return sha256(JSON.stringify({
    candidateId,
    id: plan.id,
    title: plan.title,
    allowedPaths: [...plan.allowedPaths].sort(),
    description: plan.description,
  }));
}

export function createApprovalId(candidateId: string, proposalHash: string, approvedAt: string): string {
  return `approval-${sha256(`${candidateId}:${proposalHash}:${approvedAt}`).slice(0, 16)}`;
}
