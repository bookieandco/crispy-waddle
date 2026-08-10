import type { CodingAgentAdapter, EvolutionExecutionPlan, ExecutionEvidence, ExecutionWorkspace } from "./evolution-executor";

export interface ClaudeCodeRunner {
  run(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
  }): Promise<{ changedFiles: string[]; tests: ExecutionEvidence["tests"]; securityChecks: ExecutionEvidence["securityChecks"]; diffSummary: string }>;
}

const DEFAULT_ALLOWED_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "Bash(git status)",
  "Bash(git diff)",
  "Bash(pnpm test)",
  "Bash(pnpm typecheck)",
];

const DEFAULT_DISALLOWED_TOOLS = [
  "WebFetch",
  "WebSearch",
  "Bash(gh)",
  "Bash(git push)",
  "Bash(git commit)",
  "Bash(rm -rf)",
  "Bash(curl)",
];

export class ClaudeCodeEvolutionAdapter implements CodingAgentAdapter {
  constructor(
    private readonly runner: ClaudeCodeRunner,
    private readonly maxTurns = 12,
  ) {}

  async execute(input: { plan: EvolutionExecutionPlan; workspace: ExecutionWorkspace }): Promise<ExecutionEvidence> {
    const allowedTools = input.plan.allowedPaths.length
      ? DEFAULT_ALLOWED_TOOLS
      : DEFAULT_ALLOWED_TOOLS;

    const result = await this.runner.run({
      workspace: input.workspace,
      prompt: buildPrompt(input.plan),
      allowedTools,
      disallowedTools: DEFAULT_DISALLOWED_TOOLS,
      maxTurns: this.maxTurns,
    });

    return {
      changedFiles: result.changedFiles,
      tests: result.tests,
      securityChecks: result.securityChecks,
      diffSummary: result.diffSummary,
    };
  }
}

function buildPrompt(plan: EvolutionExecutionPlan) {
  return [
    `You are executing approved Jhadina evolution plan ${plan.id}: ${plan.title}.`,
    "Work only inside the approved isolated workspace.",
    `Allowed paths: ${plan.allowedPaths.join(", ") || "none"}.`,
    `Risk: ${plan.risk}.`,
    "Do not commit, push, deploy, access secrets, modify protected authority boundaries, or broaden scope.",
    "Inspect first, make the smallest defensible change, then run the requested verification commands.",
    `Tests: ${plan.testCommands.join(" && ") || "use repository tests when available"}.`,
    `Security checks: ${plan.securityChecks.join(", ") || "inspect the diff for security regressions"}.`,
    "Return structured evidence describing changed files, tests, security checks, and the diff.",
  ].join("\n");
}
