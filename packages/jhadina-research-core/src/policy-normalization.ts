export type ResearchPlanningPolicyDecision = "allow" | "deny" | "escalate";
export type CanonicalActionPolicyDecision = "allow" | "deny" | "approval_required";

/**
 * Research planning has an "escalate" state; Action Core calls the same
 * condition "approval_required". This adapter is the only permitted collapse.
 */
export function normalizeResearchPolicyDecision(
  decision: ResearchPlanningPolicyDecision,
): CanonicalActionPolicyDecision {
  if (decision === "allow") return "allow";
  if (decision === "deny") return "deny";
  return "approval_required";
}
