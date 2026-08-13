export type ExecutionRisk = "low" | "medium" | "high" | "critical";

export interface EvolutionExecutionPlan {
  id: string;
  title: string;
  risk: ExecutionRisk;
  requiresApproval: boolean;
  allowedPaths: string[];
  testCommands: string[];
  securityChecks: string[];
}

export interface ExecutionWorkspace {
  path: string;
  branch: string;
}

export interface ExecutionEvidence {
  changedFiles: string[];
  tests: Array<{ command: string; passed: boolean; output?: string }>;
  securityChecks: Array<{ name: string; passed: boolean; detail?: string }>;
  diffSummary: string;
}

export interface CodingAgentAdapter {
  execute(input: {
    plan: EvolutionExecutionPlan;
    workspace: ExecutionWorkspace;
    context?: unknown;
  }): Promise<ExecutionEvidence>;
}

const CRITICAL_PATHS = [
  "/identity",
  "/policy",
  "/values",
  "/security",
  "/secrets",
  "/payments",
  "/transfers",
  "/military",
];

export type GovernedExecutionStatus = "completed" | "needs_approval" | "blocked" | "failed";

export interface GovernedExecutionResult {
  status: GovernedExecutionStatus;
  workspace?: ExecutionWorkspace;
  evidence?: ExecutionEvidence;
  reason?: string;
}

export class GovernedEvolutionExecutor {
  constructor(private readonly agent: CodingAgentAdapter) {}

  async execute(
    plan: EvolutionExecutionPlan,
    workspace: ExecutionWorkspace,
    approved = false,
  ): Promise<GovernedExecutionResult> {
    if (plan.risk === "critical") {
      return { status: "blocked", reason: "Critical evolution changes require a separate controlled process." };
    }
    if (plan.requiresApproval && !approved) {
      return { status: "needs_approval", workspace, reason: "User approval is required before execution." };
    }
    if (plan.allowedPaths.some((path) => CRITICAL_PATHS.some((critical) => path.includes(critical)))) {
      return { status: "blocked", workspace, reason: "Plan touches a protected Jhadina authority boundary." };
    }

    try {
      const evidence = await this.agent.execute({ plan, workspace });
      const testsPassed = evidence.tests.every((test) => test.passed);
      const securityPassed = evidence.securityChecks.every((check) => check.passed);
      return {
        status: testsPassed && securityPassed ? "completed" : "failed",
        workspace,
        evidence,
        reason: testsPassed && securityPassed ? undefined : "Verification failed; no production mutation is permitted.",
      };
    } catch (error) {
      return {
        status: "failed",
        workspace,
        reason: error instanceof Error ? error.message : "Coding agent execution failed.",
      };
    }
  }
}
