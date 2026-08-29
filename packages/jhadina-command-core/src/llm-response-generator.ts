import type { LLMMessage, LLMRouter } from "../jhadina-llm-core/src/llm-contract";
import type { JhadinaResponse, JhadinaResponseGenerator, JhadinaResponseRequest } from "./response-generation";

/** Response generator backed by the capability-aware Jhadina LLM router. */
export class LLMResponseGenerator implements JhadinaResponseGenerator {
  constructor(private readonly router: LLMRouter) {}

  async generate(request: JhadinaResponseRequest): Promise<JhadinaResponse> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: buildSystemContext(request),
      },
      ...(request.conversationContext
        ? [{ role: "system" as const, content: `Conversation context:\n${request.conversationContext}` }]
        : []),
      ...(request.personalityContext
        ? [{ role: "system" as const, content: `Personality context:\n${request.personalityContext}` }]
        : []),
      ...(request.userUtterance
        ? [{ role: "user" as const, content: request.userUtterance }]
        : []),
    ];

    const response = await this.router.complete({
      messages,
      requiredCapabilities: ["chat"],
      requiredModalities: ["text"],
    });

    return {
      text: response.text,
      context: request.context,
    };
  }
}

function buildSystemContext(request: JhadinaResponseRequest): string {
  const { context } = request;
  return [
    "You are Jhadina's conversational response layer.",
    "Treat the supplied command context as authoritative system truth.",
    "Do not claim an action succeeded unless the context says it executed successfully.",
    `Command ID: ${context.commandId}`,
    `Disposition: ${context.disposition}`,
    `Authoritative: ${context.authoritative}`,
    context.capability ? `Capability: ${context.capability}` : undefined,
    context.result !== undefined ? `Result: ${safeSerialize(context.result)}` : undefined,
    context.rationale ? `Rationale: ${context.rationale}` : undefined,
    context.clarification ? `Clarification needed: ${context.clarification}` : undefined,
  ].filter(Boolean).join("\n");
}

function safeSerialize(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable result]";
  }
}
