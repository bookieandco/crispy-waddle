import type { JhadinaResponseContext } from "./response-context";

export interface JhadinaResponseRequest {
  context: JhadinaResponseContext;
  userUtterance?: string;
  conversationContext?: string;
  personalityContext?: string;
}

export interface JhadinaResponse {
  text: string;
  context: JhadinaResponseContext;
}

export interface JhadinaResponseGenerator {
  generate(request: JhadinaResponseRequest): Promise<JhadinaResponse>;
}

/** Deterministic renderer used when no language model is attached. */
export class DeterministicResponseGenerator implements JhadinaResponseGenerator {
  async generate(request: JhadinaResponseRequest): Promise<JhadinaResponse> {
    const { context } = request;
    const result = context.capabilityResult;

    let text: string;
    switch (context.disposition) {
      case "execute":
        text = result === undefined ? "Done." : `Done. ${formatResult(result)}`;
        break;
      case "answer":
        text = result === undefined ? "I have an answer ready." : formatResult(result);
        break;
      case "clarify":
        text = context.clarification ?? "I need a little more information before I continue.";
        break;
      case "approve":
        text = context.rationale ?? "I need your approval before I continue.";
        break;
      case "deny":
        text = context.rationale ?? "I can't perform that action.";
        break;
    }

    return { text, context };
  }
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return "The operation returned a result I can't render automatically.";
  }
}
