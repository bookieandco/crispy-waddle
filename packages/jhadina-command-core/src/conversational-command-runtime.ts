import type { JhadinaCommand } from "./command-contract";
import type { CommandExecutionResult, RegistryCommandGateway } from "./registry-command-gateway";
import { toResponseContext } from "./response-context";
import type { JhadinaResponse, JhadinaResponseGenerator } from "./response-generation";

export interface ConversationalCommandRuntimeRequest {
  command: JhadinaCommand;
  conversationContext?: string;
  personalityContext?: string;
}

export interface ConversationalCommandRuntime {
  run(request: ConversationalCommandRuntimeRequest): Promise<JhadinaResponse>;
}

/** Canonical composition: command execution truth is converted into conversational output. */
export class GatewayConversationalRuntime implements ConversationalCommandRuntime {
  constructor(
    private readonly gateway: RegistryCommandGateway,
    private readonly responses: JhadinaResponseGenerator,
  ) {}

  async run(request: ConversationalCommandRuntimeRequest): Promise<JhadinaResponse> {
    const execution: CommandExecutionResult = await this.gateway.execute(request.command);
    const context = toResponseContext({
      commandId: execution.commandId,
      disposition: execution.disposition,
      result: execution.result,
      rationale: execution.rationale,
      clarification: execution.clarification,
    });

    return this.responses.generate({
      context,
      userUtterance: request.command.utterance,
      conversationContext: request.conversationContext,
      personalityContext: request.personalityContext,
    });
  }
}
