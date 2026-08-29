import type { CommandEntry, CommandGatewayPort } from "../../jhadina-command-core/src";
import { ConversationalCommandEntry } from "../../jhadina-command-core/src";

/** Mainframe-facing adapter: all conversational inputs enter through one command boundary. */
export class GatewayCommandEntryAdapter implements CommandEntry {
  private readonly entry: ConversationalCommandEntry;

  constructor(gateway: CommandGatewayPort) {
    this.entry = new ConversationalCommandEntry(gateway);
  }

  submitText(text: string, metadata: Record<string, unknown> = {}) {
    return this.entry.submitText(text, metadata);
  }

  submitVoice(transcript: string, metadata: Record<string, unknown> = {}) {
    return this.entry.submitVoice(transcript, metadata);
  }

  submitShortcut(command: string, metadata: Record<string, unknown> = {}) {
    return this.entry.submitShortcut(command, metadata);
  }
}
