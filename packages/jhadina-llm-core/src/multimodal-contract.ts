export type LLMContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; url: string; mediaType?: string }
  | { type: "audio_url"; url: string; mediaType?: string };

export interface MultimodalMessage {
  role: "system" | "user" | "assistant";
  content: string | LLMContentPart[];
}

export function hasModalityInput(message: MultimodalMessage, type: LLMContentPart["type"]): boolean {
  if (typeof message.content === "string") return false;
  return message.content.some((part) => part.type === type);
}
