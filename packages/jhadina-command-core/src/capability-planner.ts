import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvocation, CommandPlan, JhadinaCommand } from "./command-contract";

export interface ResolvedCommand {
  capability: string;
  version?: number;
  arguments: Record<string, unknown>;
}

export interface CommandResolver {
  resolve(command: JhadinaCommand): Promise<ResolvedCommand | null>;
}

export class RegistryBackedCommandPlanner {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly resolver: CommandResolver,
  ) {}

  async plan(command: JhadinaCommand): Promise<CommandPlan> {
    const resolved = await this.resolver.resolve(command);
    if (!resolved) {
      return {
        commandId: command.id,
        disposition: "clarify",
        clarification: "I need a little more information to know what action you want.",
      };
    }

    const definition = this.registry.get(resolved.capability);
    if (!definition) {
      return {
        commandId: command.id,
        disposition: "deny",
        rationale: `Unknown capability: ${resolved.capability}`,
      };
    }

    const invocation: CapabilityInvocation = {
      capability: definition.name,
      version: resolved.version ?? definition.version,
      arguments: resolved.arguments,
      risk: definition.risk,
      requiresApproval: definition.risk === "financial" || definition.risk === "destructive",
    };

    return {
      commandId: command.id,
      disposition: invocation.requiresApproval ? "approve" : "execute",
      invocation,
    };
  }
}
