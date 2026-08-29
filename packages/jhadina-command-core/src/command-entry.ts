import type { CommandRequest, CommandResult } from "./command-contract";

export interface CommandGatewayPort {
  execute(request: CommandRequest): Promise<CommandResult>;
}

export interface CommandEntry {
  submitText(text: string, metadata?: Record<string, unknown>): Promise<CommandResult>;
  submitVoice(transcript: string, metadata?: Record<string, unknown>): Promise<CommandResult>;
  submitShortcut(command: string, metadata?: Record<string, unknown>): Promise<CommandResult>;
}

export class ConversationalCommandEntry implements CommandEntry {
  constructor(private readonly gateway: CommandGatewayPort) {}

  submitText(text: string, metadata: Record<string, unknown> = {}): Promise<CommandResult> {
    return this.gateway.execute({ source: "text", input: text, metadata });
  }

  submitVoice(transcript: string, metadata: Record<string, unknown> = {}): Promise<CommandResult> {
    return this.gateway.execute({ source: "voice", input: transcript, metadata });
  }

  submitShortcut(command: string, metadata: Record<string, unknown> = {}): Promise<CommandResult> {
    return this.gateway.execute({ source: "shortcut", input: command, metadata });
  }
}
