import type { JhadinaCommand, CommandPlan, CommandPlanner } from "../../jhadina-command-core/src";
import { resolveCapability } from "../../jhadina-command-core/src";
import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { ActionExecutor } from "../../jhadina-action-core/src";

export interface GatewayCommandResult {
  ok: boolean;
  commandId: string;
  disposition: CommandPlan["disposition"];
  capability?: string;
  output?: unknown;
  error?: string;
}

export class GatewayCommandRuntime {
  constructor(
    private readonly planner: CommandPlanner,
    private readonly capabilities: CapabilityRegistry,
    private readonly actions: ActionExecutor,
    private readonly userId: string,
  ) {}

  async execute(command: JhadinaCommand): Promise<GatewayCommandResult> {
    const plan = await this.planner.plan(command);

    if (plan.disposition !== "execute" || !plan.invocation) {
      return {
        ok: plan.disposition !== "deny",
        commandId: command.id,
        disposition: plan.disposition,
        clarification: plan.clarification,
        output: plan.rationale,
      } as GatewayCommandResult;
    }

    const definition = resolveCapability(this.capabilities, plan.invocation);

    const result = await this.actions.execute({
      id: command.id,
      userId: this.userId,
      type: definition.name,
      action: plan.invocation.arguments,
      requestedAt: command.occurredAt,
    });

    return {
      ok: true,
      commandId: command.id,
      disposition: "execute",
      capability: definition.name,
      output: result,
    };
  }
}
