import type { LLMMessage, LLMRouter } from "../jhadina-llm-core/src/llm-contract";
import { toVisionInput, type VisionObservation } from "./vision-input-adapter";
import type { JhadinaResponse } from "./response-generation";
import type { JhadinaResponseContext } from "./response-context";

export interface VisionResponseRequest {
  observation: VisionObservation;
  prompt: string;
  context: JhadinaResponseContext;
  conversationContext?: string;
  personalityContext?: string;
}

export class VisionResponseGenerator {
  constructor(private readonly router: LLMRouter) {}

  async generate(request: VisionResponseRequest): Promise<JhadinaResponse> {
    const input = toVisionInput(request.observation, request.prompt);
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: [
          { type: "text", text: "You are Jhadina's vision-aware conversational response layer." },
        ],
      },
      ...(request.conversationContext ? [{ role: "system" as const, content: request.conversationContext }] : []),
      ...(request.personalityContext ? [{ role: "system" as const, content: request.personalityContext }] : []),
      { role: "user", content: input.content },
    ];

    const response = await this.router.complete({
      messages,
      requiredCapabilities: ["chat", "vision"],
      requiredModalities: ["vision"],
      metadata: { commandId: request.context.commandId },
    });

    return { text: response.text, context: request.context };
  }
}
