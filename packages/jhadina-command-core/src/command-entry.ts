import type { CommandPlan, JhadinaCommand } from "./command-contract";

export interface CommandGatewayPort {
  execute(command: JhadinaCommand): Promise<unknown>;
}

export interface CommandEntry {
  submitText(text: string, metadata?: Record<string, unknown>): Promise<unknown>;
  submitVoice(transcript: string, metadata?: Record<string, unknown>): Promise<unknown>;
  submitShortcut(command: string, metadata?: Record<string, unknown>): Promise<unknown>;
}

function command(source: JhadinaCommand["source"], utterance: string, metadata: Record<string, unknown>): JhadinaCommand {
  return {
    id: crypto.randomUUID(),
    source,
    utterance,
    occurredAt: new Date().toISOString(),
    contextRefs: typeof metadata.contextRefs === "object" && Array.isArray(metadata.contextRefs)
      ? metadata.contextRefs as string[]
      : undefined,
  };
}

export class ConversationalCommandEntry implements CommandEntry {
  constructor(private readonly gateway: CommandGatewayPort) {}

  submitText(text: string, metadata: Record<string, unknown> = {}) {
    return this.gateway.execute(command("text", text, metadata));
  }

  submitVoice(transcript: string, metadata: Record<string, unknown> = {}) {
    return this.gateway.execute(command("voice", transcript, metadata));
  }

  submitShortcut(input: string, metadata: Record<string, unknown> = {}) {
    return this.gateway.execute(command("shortcut", input, metadata));
  }
}
