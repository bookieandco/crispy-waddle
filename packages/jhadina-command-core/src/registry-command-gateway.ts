import type { CapabilityInvoker, CommandGatewayPort, CommandPlanner } from "./command-contract";

export interface CommandExecutionResult {
  commandId: string;
  disposition: "answer" | "execute" | "clarify" | "deny" | "approve";
  result?: unknown;
  rationale?: string;
  clarification?: string;
}

/** Canonical command gateway: plan first, then invoke only executable capabilities. */
export class RegistryCommandGateway implements CommandGatewayPort {
  constructor(
    private readonly planner: CommandPlanner,
    private readonly invoker: CapabilityInvoker,
  ) {}

  async execute(command: Parameters<CommandGatewayPort["execute"]>[0]): Promise<CommandExecutionResult> {
    const plan = await this.planner.plan(command);

    if (plan.disposition !== "execute" || !plan.invocation) {
      return {
        commandId: plan.commandId,
        disposition: plan.disposition,
        rationale: plan.rationale,
        clarification: plan.clarification,
      };
    }

    const result = await this.invoker.invoke(plan.invocation);
    return {
      commandId: plan.commandId,
      disposition: plan.disposition,
      result,
    };
  }
}
