import type { JhadinaCommand } from "./command-contract";
import type { JhadinaResponse } from "./response-generation";
import type { ConversationalCommandRuntime } from "./conversational-command-runtime";
import type { ControlCenterCommandRequest, ControlCenterConversationalPort } from "./control-center-port";

export type ControlCenterInputSource = "text" | "voice" | "shortcut" | "api";

export interface ControlCenterInput {
  source: ControlCenterInputSource;
  text: string;
  contextRefs?: string[];
  conversationContext?: string;
  personalityContext?: string;
  occurredAt?: string;
}

/** Converts UI/API input into the canonical JhadinaCommand without exposing command internals to the UI. */
export function toJhadinaCommand(input: ControlCenterInput): JhadinaCommand {
  return {
    id: crypto.randomUUID(),
    source: input.source,
    utterance: input.text,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    contextRefs: input.contextRefs,
  };
}

export interface ControlCenterResponse {
  text: string;
  context: JhadinaResponse["context"];
}

export class ControlCenterRequestAdapter {
  constructor(private readonly port: ControlCenterConversationalPort) {}

  async respond(input: ControlCenterInput): Promise<ControlCenterResponse> {
    const request: ControlCenterCommandRequest = {
      command: toJhadinaCommand(input),
      conversationContext: input.conversationContext,
      personalityContext: input.personalityContext,
    };

    const response = await this.port.respond(request);
    return { text: response.text, context: response.context };
  }
}

export function createControlCenterRequestAdapter(
  runtime: ConversationalCommandRuntime,
): ControlCenterRequestAdapter {
  return new ControlCenterRequestAdapter({
    respond: (request) => runtime.run(request),
  });
}
