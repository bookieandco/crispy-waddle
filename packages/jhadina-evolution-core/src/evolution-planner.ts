import type { EvolutionCommand } from "./command-parser";

export type RiskLevel = "safe" | "review" | "critical";

export type EvolutionPlan = {
  command: EvolutionCommand;
  risk: RiskLevel;
  requiresApproval: boolean;
  steps: string[];
  forbiddenCapabilities: string[];
};

const CRITICAL_TARGETS = new Set(["identity", "policy", "values", "encryption", "keys", "military", "production", "payments", "transfers", "auth"]);

export function planEvolution(command: EvolutionCommand): EvolutionPlan {
  if (command.kind === "unknown") {
    return {
      command,
      risk: "review",
      requiresApproval: true,
      steps: ["Clarify the requested engineering task before modifying the repository."],
      forbiddenCapabilities: [],
    };
  }

  if (command.kind === "audit") {
    return {
      command,
      risk: "safe",
      requiresApproval: false,
      steps: ["Inspect repository state", "Identify likely root cause", "Produce evidence-backed repair plan"],
      forbiddenCapabilities: ["write-production-code", "deploy-production"],
    };
  }

  const normalized = command.request.toLowerCase();
  const critical = [...CRITICAL_TARGETS].some((target) => normalized.includes(target));

  if (command.kind === "apply") {
    return {
      command,
      risk: "review",
      requiresApproval: true,
      steps: ["Load the previously reviewed plan", "Revalidate policy and repository state", "Apply only the approved diff", "Run verification", "Record audit evidence"],
      forbiddenCapabilities: ["expand-scope", "modify-secrets"],
    };
  }

  return {
    command,
    risk: critical ? "critical" : "review",
    requiresApproval: true,
    steps: ["Inspect repository and current branch", "Diagnose the requested issue", "Generate a minimal patch", "Run tests and type checks", "Run security checks", "Present diff and evidence", "Wait for explicit approval", "Commit or open a draft PR"],
    forbiddenCapabilities: ["read-secrets", "export-secrets", "modify-encryption-keys", "financial-transfer", "military-operation", "production-deploy"],
  };
}
