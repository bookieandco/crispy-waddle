import type {
  CandidateDecision,
  EvolutionCandidateRepository,
  StoredEvolutionCandidate,
} from "./evolution-candidate-repository";

export type ApprovalCenterAction = "approve" | "reject" | "defer";

export interface ApprovalCenterActor {
  actorId: string;
}

export interface ApprovalCenterDecisionRequest {
  candidateId: string;
  action: ApprovalCenterAction;
  actor: ApprovalCenterActor;
  reason?: string;
}

export interface ApprovalCenterListResponse {
  candidates: StoredEvolutionCandidate[];
}

export interface ApprovalCenterDecisionResponse {
  candidate: StoredEvolutionCandidate;
}

/**
 * API-neutral application service for the Approval Center.
 *
 * HTTP/Next.js handlers should delegate to this service rather than talking
 * directly to Supabase. This keeps authorization and candidate state changes
 * deterministic and testable outside the web layer.
 */
export class ApprovalCenterApi {
  constructor(private readonly candidates: EvolutionCandidateRepository) {}

  async list(limit = 50): Promise<ApprovalCenterListResponse> {
    return { candidates: await this.candidates.listPending(limit) };
  }

  async decide(
    request: ApprovalCenterDecisionRequest,
  ): Promise<ApprovalCenterDecisionResponse> {
    if (!request.actor.actorId) throw new Error("Approval Center actor is required");
    if (!request.candidateId) throw new Error("Evolution candidate ID is required");

    const decision = actionToDecision(request.action);
    const candidate = await this.candidates.decide(
      request.candidateId,
      decision,
      request.actor.actorId,
      request.reason,
    );

    return { candidate };
  }
}

function actionToDecision(action: ApprovalCenterAction): Exclude<CandidateDecision, "PENDING"> {
  switch (action) {
    case "approve":
      return "APPROVED";
    case "reject":
      return "REJECTED";
    case "defer":
      return "DEFERRED";
    default:
      return assertNever(action);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Approval Center action: ${String(value)}`);
}
