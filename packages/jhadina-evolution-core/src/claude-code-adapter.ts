import type { CodingAgentAdapter, EvolutionExecutionPlan, ExecutionEvidence, ExecutionWorkspace } from "./evolution-executor";
import type { ClaudeRepairContext } from "./claude-repair-context";
import { renderClaudeRepairPrompt } from "./claude-repair-context";

export interface ClaudeCodeRunner {
  run(input: {
    workspace: ExecutionWorkspace;
    prompt: string;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
  }): Promise<{ changedFiles: string[]; tests: ExecutionEvidence["tests"]; securityChecks: ExecutionEvidence["securityChecks"]; diffSummary: string }>;
}

export interface ClaudeRepairRunner extends ClaudeCodeRunner {
  runRepair?(input: {
    workspace: ExecutionWorkspace;
    context: ClaudeRepairContext;
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
    private readonly runner: ClaudeRepairRunner,
    private readonly maxTurns = 12,
  ) {}

  async execute(input: { plan: EvolutionExecutionPlan; workspace: ExecutionWorkspace; context?: ClaudeRepairContext }): Promise<ExecutionEvidence> {
    const context = input.context;
    if (!context) {
      throw new Error("ClaudeCodeEvolutionAdapter requires ClaudeRepairContext with repository evidence");
    }

    const allowedTools = [...DEFAULT_ALLOWED_TOOLS];
    const disallowedTools = [...DEFAULT_DISALLOWED_TOOLS];
    const prompt = renderClaudeRepairPrompt(context);

    const result = this.runner.runRepair
      ? await this.runner.runRepair({
          workspace: input.workspace,
          context,
          allowedTools,
          disallowedTools,
          maxTurns: this.maxTurns,
        })
      : await this.runner.run({
          workspace: input.workspace,
          prompt,
          allowedTools,
          disallowedTools,
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
