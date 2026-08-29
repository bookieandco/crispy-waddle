import type { LLMContentPart, LLMMessage } from "./llm-contract";

export type { LLMContentPart } from "./llm-contract";
export type MultimodalMessage = LLMMessage;

export function hasModalityInput(message: MultimodalMessage, type: LLMContentPart["type"]): boolean {
  if (typeof message.content === "string") return false;
  return message.content.some((part) => part.type === type);
}
