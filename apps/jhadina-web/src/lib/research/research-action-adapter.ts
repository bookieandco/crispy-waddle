import type { ActionRequest } from "../../../../../packages/jhadina-action-core/src/action-executor.js";
import { normalizeResearchPolicyDecision, type ResearchPlanningPolicyDecision } from "../../../../../packages/jhadina-research-core/src/policy-normalization.js";

export type ResearchRunAction = {
  planId: string;
  policyDecisionId: string;
};

/**
 * Converts research planning state into the existing Action Core vocabulary.
 * It does not execute anything and cannot manufacture an approval receipt.
 */
export function createResearchRunActionRequest(input: {
  requestId: string;
  userId: string;
  planId: string;
  policyDecisionId: string;
  planningDecision: ResearchPlanningPolicyDecision;
  requestedAt: string;
  approvalReceiptId?: string;
}): { request: ActionRequest<ResearchRunAction>; decision: "allow" | "deny" | "approval_required" } {
  return {
    decision: normalizeResearchPolicyDecision(input.planningDecision),
    request: {
      id: input.requestId,
      userId: input.userId,
      type: "research.run",
      action: { planId: input.planId, policyDecisionId: input.policyDecisionId },
      requestedAt: input.requestedAt,
      approvalReceiptId: input.approvalReceiptId,
    },
  };
}
