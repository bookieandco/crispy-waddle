export type CommandSource = "text" | "voice" | "screen" | "shortcut" | "api";

export type CommandDisposition = "answer" | "execute" | "clarify" | "deny" | "approve";

export interface JhadinaCommand {
  id: string;
  source: CommandSource;
  utterance: string;
  occurredAt: string;
  contextRefs?: string[];
}

export interface CapabilityInvocation {
  capability: string;
  version: number;
  arguments: Record<string, unknown>;
  risk: "read" | "write" | "external" | "financial" | "destructive";
  requiresApproval: boolean;
}

export interface CommandPlan {
  commandId: string;
  disposition: CommandDisposition;
  invocation?: CapabilityInvocation;
  rationale?: string;
  clarification?: string;
}

export interface CommandPlanner {
  plan(command: JhadinaCommand): Promise<CommandPlan>;
}

export interface CapabilityInvoker {
  invoke(invocation: CapabilityInvocation): Promise<unknown>;
}
