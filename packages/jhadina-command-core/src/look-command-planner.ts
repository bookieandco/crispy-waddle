import type { CommandPlan, CommandPlanner, JhadinaCommand } from "./command-contract";

const LOOK_PATTERNS = [
  /\blook at (this|that|my screen)\b/i,
  /\bdo you see (this|that)\b/i,
  /\bwhat do you see\b/i,
  /\bcheck (this|that) out\b/i,
  /\blook at my screen\b/i,
];

export class LookCommandPlanner implements CommandPlanner {
  async plan(command: JhadinaCommand): Promise<CommandPlan> {
    if (!LOOK_PATTERNS.some((pattern) => pattern.test(command.utterance))) {
      return { commandId: command.id, disposition: "answer", rationale: "No screen-look intent matched." };
    }

    return {
      commandId: command.id,
      disposition: "execute",
      invocation: {
        capability: "perception.look_at_screen",
        version: 1,
        arguments: { policy: { enabled: true, intervalMs: 0, onDemandOnly: true } },
        risk: "read",
        requiresApproval: false,
      },
      rationale: "Explicit screen-observation request detected.",
    };
  }
}
