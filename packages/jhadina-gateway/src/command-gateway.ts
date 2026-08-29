import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { ActionExecutor } from "../../jhadina-action-core/src";
import type { CapabilityInvocation, CommandPlan, JhadinaCommand } from "../../jhadina-command-core/src";
import { resolveCapability } from "../../jhadina-command-core/src/capability-adapter";

export interface GatewayCommandResult {
  commandId: string;
  disposition: CommandPlan["disposition"];
  result?: unknown;
}

export interface CommandPlanResolver {
  plan(command: JhadinaCommand): Promise<CommandPlan>;
}

export class JhadinaCommandGateway {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly planner: CommandPlanResolver,
    private readonly actions: ActionExecutor<CapabilityInvocation, unknown>,
  ) {}

  async handle(command: JhadinaCommand): Promise<GatewayCommandResult> {
    const plan = await this.planner.plan(command);

    if (plan.disposition !== "execute" || !plan.invocation) {
      return { commandId: command.id, disposition: plan.disposition };
    }

    const capability = resolveCapability(this.registry, plan.invocation);
    const result = await this.actions.execute({
      id: command.id,
      userId: "primary-user",
      type: capability.name,
      action: plan.invocation,
      requestedAt: command.occurredAt,
    });

    return { commandId: command.id, disposition: "execute", result };
  }
}
