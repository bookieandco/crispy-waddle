import type { CommandRequest, CommandResult } from "../../jhadina-command-core/src";
import { resolveCapability } from "../../jhadina-command-core/src";
import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { ActionExecutor } from "../../jhadina-action-core/src";

export interface PlannedInvocation {
  capability: string;
  version: number;
  risk: "read" | "write" | "external" | "financial" | "destructive";
  arguments?: Record<string, unknown>;
}

export interface CommandPlannerPort {
  plan(request: CommandRequest): Promise<PlannedInvocation>;
}

export class GatewayCommandRuntime {
  constructor(
    private readonly planner: CommandPlannerPort,
    private readonly capabilities: CapabilityRegistry,
    private readonly actions: ActionExecutor,
  ) {}

  async execute(request: CommandRequest): Promise<CommandResult> {
    const invocation = await this.planner.plan(request);
    const definition = resolveCapability(this.capabilities, invocation);

    const result = await this.actions.execute({
      id: crypto.randomUUID(),
      type: definition.name,
      payload: invocation.arguments ?? {},
    });

    return {
      ok: result.status === "completed",
      capability: definition.name,
      status: result.status,
      output: result.output,
    };
  }
}
