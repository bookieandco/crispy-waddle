import type { CodingAgentAdapter, EvolutionExecutionPlan, ExecutionEvidence, ExecutionWorkspace } from "./evolution-executor";
import type { ClaudeRepairContext } from "./claude-repair-context";
import { renderClaudeRepairPrompt } from "./claude-repair-context";
import type { ClaudeWorkflowExecutionResult } from "./claude-github-actions-runner";

export interface ClaudeCodeRunner {
  run(input: { workspace: ExecutionWorkspace; prompt: string; allowedTools: string[]; disallowedTools: string[]; maxTurns: number; context?: ClaudeRepairContext }): Promise<{ changedFiles: string[]; tests: ExecutionEvidence["tests"]; securityChecks: ExecutionEvidence["securityChecks"]; diffSummary: string }>;
}

export interface ClaudeRepairRunner extends ClaudeCodeRunner {
  runGoverned?(input: { workspace: ExecutionWorkspace; prompt: string; allowedTools: string[]; disallowedTools: string[]; maxTurns: number; context: ClaudeRepairContext }): Promise<ClaudeWorkflowExecutionResult>;
  runRepair?(input: { workspace: ExecutionWorkspace; context: ClaudeRepairContext; allowedTools: string[]; disallowedTools: string[]; maxTurns: number }): Promise<{ changedFiles: string[]; tests: ExecutionEvidence["tests"]; securityChecks: ExecutionEvidence["securityChecks"]; diffSummary: string }>;
}

const DEFAULT_ALLOWED_TOOLS = [
  "Read", "Glob", "Grep", "Edit",
  "Bash(git status)", "Bash(git diff)",
  "Bash(pnpm test)", "Bash(pnpm typecheck)",
];

const DEFAULT_DISALLOWED_TOOLS = [
  "WebFetch", "WebSearch", "Bash(gh)", "Bash(git push)",
  "Bash(git commit)", "Bash(git merge)", "Bash(rm -rf)", "Bash(curl)",
];

export class ClaudeCodeEvolutionAdapter implements CodingAgentAdapter {
  constructor(private readonly runner: ClaudeRepairRunner, private readonly maxTurns = 12) {}

  private policy() {
    return { allowedTools: [...DEFAULT_ALLOWED_TOOLS], disallowedTools: [...DEFAULT_DISALLOWED_TOOLS] };
  }

  async execute(input: { plan: EvolutionExecutionPlan; workspace: ExecutionWorkspace; context?: ClaudeRepairContext }): Promise<ExecutionEvidence> {
    if (!input.context) throw new Error("ClaudeCodeEvolutionAdapter requires ClaudeRepairContext with repository evidence");
    const { allowedTools, disallowedTools } = this.policy();
    const prompt = renderClaudeRepairPrompt(input.context);

    if (this.runner.runRepair) {
      return this.runner.runRepair({ workspace: input.workspace, context: input.context, allowedTools, disallowedTools, maxTurns: this.maxTurns });
    }

    return this.runner.run({ workspace: input.workspace, prompt, allowedTools, disallowedTools, maxTurns: this.maxTurns, context: input.context });
  }

  async runGoverned(input: { workspace: ExecutionWorkspace; prompt: string; allowedTools: string[]; disallowedTools: string[]; maxTurns: number; context: ClaudeRepairContext }): Promise<ClaudeWorkflowExecutionResult> {
    if (!this.runner.runGoverned) throw new Error("ClaudeCodeEvolutionAdapter runner does not implement governed workflow execution");
    const { allowedTools, disallowedTools } = this.policy();
    return this.runner.runGoverned({ ...input, allowedTools, disallowedTools, maxTurns: Math.min(input.maxTurns, this.maxTurns) });
  }
}
