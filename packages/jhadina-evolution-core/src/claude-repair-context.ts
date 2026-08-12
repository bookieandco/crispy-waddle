import type { RepositoryIntelligenceEvidence } from "./repository-intelligence";
import type { EvolutionExecutionPlan } from "./evolution-executor";

export interface ClaudeRepairContext {
  plan: EvolutionExecutionPlan;
  repository: RepositoryIntelligenceEvidence;
}

export function buildClaudeRepairContext(
  plan: EvolutionExecutionPlan,
  repository: RepositoryIntelligenceEvidence,
): ClaudeRepairContext {
  const scope = new Set(plan.allowedPaths);
  const relevantFiles = repository.snapshot.relevantFiles.filter((file) =>
    scope.size === 0 || [...scope].some((path) => file === path || file.startsWith(`${path}/`)),
  );

  return {
    plan: {
      ...plan,
      allowedPaths: relevantFiles.length ? relevantFiles : plan.allowedPaths,
    },
    repository: {
      ...repository,
      scope: [...scope],
    },
  };
}

export function renderClaudeRepairPrompt(context: ClaudeRepairContext): string {
  const snapshot = context.repository.snapshot;
  return [
    `Approved Jhadina repair: ${context.plan.id} — ${context.plan.title}`,
    `Risk: ${context.plan.risk}`,
    `Repository: ${snapshot.repository}`,
    `Branch: ${snapshot.branch}`,
    `Base commit: ${snapshot.commit}`,
    `Authorized paths: ${context.plan.allowedPaths.join(", ") || "none"}`,
    `Repository evidence: ${context.repository.findings.join("; ")}`,
    `Relevant files: ${context.plan.allowedPaths.join(", ") || "none"}`,
    `Tests: ${context.plan.testCommands.join(" && ") || "repository tests"}`,
    `Security checks: ${context.plan.securityChecks.join(", ") || "diff security review"}`,
    "Use the evidence as context, not as permission to expand scope.",
    "Make the smallest defensible fix. Do not commit, push, deploy, access secrets, or modify Jhadina authority boundaries.",
    "Return structured evidence for changed files, tests, security checks, and the resulting diff.",
  ].join("\n");
}
