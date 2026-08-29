import type { JhadinaCommand } from "./command-contract";
import type { JhadinaResponse } from "./response-generation";
import type { ConversationalCommandRuntime } from "./conversational-command-runtime";

export interface ControlCenterCommandRequest {
  command: JhadinaCommand;
  conversationContext?: string;
  personalityContext?: string;
}

/** Application-facing seam; UI/API code does not depend on command internals. */
export interface ControlCenterConversationalPort {
  respond(request: ControlCenterCommandRequest): Promise<JhadinaResponse>;
}

export class RuntimeControlCenterPort implements ControlCenterConversationalPort {
  constructor(private readonly runtime: ConversationalCommandRuntime) {}

  respond(request: ControlCenterCommandRequest): Promise<JhadinaResponse> {
    return this.runtime.run(request);
  }
}
