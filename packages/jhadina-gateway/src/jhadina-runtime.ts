import type { ActionExecutor, ActionHandler } from "../../jhadina-action-core/src";
import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CommandPlanner } from "../../jhadina-command-core/src";
import { GatewayCommandRuntime } from "./command-runtime";

export interface JhadinaRuntimeDependencies {
  planner: CommandPlanner;
  capabilities: CapabilityRegistry;
  actions: ActionExecutor;
  userId: string;
}

export interface JhadinaRuntime {
  commands: GatewayCommandRuntime;
}

export function composeJhadinaRuntime(deps: JhadinaRuntimeDependencies): JhadinaRuntime {
  return {
    commands: new GatewayCommandRuntime(
      deps.planner,
      deps.capabilities,
      deps.actions,
      deps.userId,
    ),
  };
}

export function registerActionHandler(
  actions: ActionExecutor,
  handler: ActionHandler<unknown, unknown>,
): void {
  actions.register(handler);
}
