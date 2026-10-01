export const OPPORTUNITY_ACTIONS = [
  "research",
  "monitor",
  "pursue",
  "pass",
  "find_partner",
  "source",
  "test",
  "create",
  "list",
  "order",
  "fulfill",
  "reconcile",
] as const;

export type OpportunityActionType = (typeof OPPORTUNITY_ACTIONS)[number];

export type OpportunityActionStatus =
  | "proposed"
  | "approved"
  | "blocked"
  | "executed"
  | "failed"
  | "cancelled";

export interface OpportunityAction {
  id: string;
  opportunityId: string;
  type: OpportunityActionType;
  status: OpportunityActionStatus;
  rationale?: string;
  evidenceIds?: string[];
  requestedAt: string;
  approvedAt?: string;
  executedAt?: string;
  actor?: "user" | "system" | "agent";
}
