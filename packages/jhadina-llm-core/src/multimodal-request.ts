import type { LLMRequest } from "./llm-contract";
import type { LLMContentPart, MultimodalMessage } from "./multimodal-contract";

export interface MultimodalLLMRequest extends Omit<LLMRequest, "messages"> {
  messages: MultimodalMessage[];
}

export function imageRequest(request: Omit<MultimodalLLMRequest, "messages"> & { prompt: string; imageUrl: string; mediaType?: string }): MultimodalLLMRequest {
  return {
    ...request,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: request.prompt },
        { type: "image_url", url: request.imageUrl, mediaType: request.mediaType },
      ],
    }],
  };
}

export function audioRequest(request: Omit<MultimodalLLMRequest, "messages"> & { prompt: string; audioUrl: string; mediaType?: string }): MultimodalLLMRequest {
  return {
    ...request,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: request.prompt },
        { type: "audio_url", url: request.audioUrl, mediaType: request.mediaType },
      ],
    }],
  };
}

export type { LLMContentPart, MultimodalMessage } from "./multimodal-contract";
