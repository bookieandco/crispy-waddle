import type { SkillCapability, SkillDefinition } from "../skills/SkillRegistry";

export type PolicyDecision = "allow" | "deny" | "ask" | "sandbox";

export interface SkillPolicyContext {
  skill: SkillDefinition;
  capability: SkillCapability;
  authenticated: boolean;
  userApproved: boolean;
  sandboxAvailable: boolean;
}

export interface SkillPolicyEvaluator {
  evaluate(context: SkillPolicyContext): PolicyDecision;
}

/**
 * Adapter between skill capabilities and Jhadina's deterministic policy gate.
 * It returns a decision only; it never invokes a handler or executor.
 */
export class SkillPolicyAdapter implements SkillPolicyEvaluator {
  evaluate(context: SkillPolicyContext): PolicyDecision {
    if (context.skill.status !== "approved") return "deny";
    if (!context.authenticated) return "deny";

    if (context.capability.risk === "high") {
      if (context.userApproved) return "allow";
      return context.sandboxAvailable ? "sandbox" : "ask";
    }

    if (context.capability.requiresApproval && !context.userApproved) return "ask";

    return "allow";
  }
}
