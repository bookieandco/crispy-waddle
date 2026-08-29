import type { JhadinaResponseContext } from "./response-context";
import type { JhadinaResponse } from "./response-generation";
import type { ConversationalCommandRuntimeRequest, ConversationalCommandRuntime } from "./conversational-command-runtime";
import type { RegistryCommandGateway } from "./registry-command-gateway";
import type { JhadinaResponseGenerator } from "./response-generation";
import type { VisionResponseGenerator } from "./vision-response-generator";
import type { VisionObservation } from "./vision-input-adapter";
import { toResponseContext } from "./response-context";

export class VisionAwareConversationalRuntime implements ConversationalCommandRuntime {
  constructor(
    private readonly gateway: RegistryCommandGateway,
    private readonly responses: JhadinaResponseGenerator,
    private readonly visionResponses: VisionResponseGenerator,
  ) {}

  async run(request: ConversationalCommandRuntimeRequest): Promise<JhadinaResponse> {
    const execution = await this.gateway.execute(request.command);
    const context = toResponseContext(execution);

    if (isVisionObservation(execution.result)) {
      return this.visionResponses.generate({
        observation: execution.result,
        prompt: request.command.utterance,
        context,
        conversationContext: request.conversationContext,
        personalityContext: request.personalityContext,
      });
    }

    return this.responses.generate({
      context,
      userUtterance: request.command.utterance,
      conversationContext: request.conversationContext,
      personalityContext: request.personalityContext,
    });
  }
}

function isVisionObservation(value: unknown): value is VisionObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; frame?: unknown };
  return (candidate.kind === "screen" || candidate.kind === "camera") &&
    Boolean(candidate.frame && typeof candidate.frame === "object");
}
