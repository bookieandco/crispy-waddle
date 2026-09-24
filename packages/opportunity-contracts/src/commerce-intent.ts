export type CommerceIntentKind =
  | "read"
  | "recommend"
  | "communicate"
  | "mutate"
  | "financial_commitment";

export type CommerceIntentRisk = "low" | "medium" | "high" | "financial";

export interface CommerceIntent {
  intentId: string;
  kind: CommerceIntentKind;
  actorId: string;
  resourceType: string;
  resourceId?: string;
  opportunityId?: string;
  requestedAt: string;
  risk: CommerceIntentRisk;
  idempotencyKey?: string;
  reason?: string;
  metadata?: Record<string, string>;
}

export type AuthorizationDecision =
  | "allow"
  | "deny"
  | "approval_required";

export interface CommerceAuthorizationDecision {
  decision: AuthorizationDecision;
  policyId: string;
  reason: string;
  decidedAt: string;
  approvalId?: string;
}

export interface CommerceAuthorizationPolicy {
  policyId: string;
  evaluate(intent: CommerceIntent): Promise<CommerceAuthorizationDecision>;
}
