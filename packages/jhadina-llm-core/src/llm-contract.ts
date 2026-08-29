export type LLMModality = "text" | "vision" | "audio" | "image" | "video";

export type LLMCapability = "chat" | "coding" | "reasoning" | "vision" | "tool_calling" | "streaming" | "structured_output";

export interface LLMProviderDescriptor {
  id: string;
  displayName: string;
  modalities: LLMModality[];
  capabilities: LLMCapability[];
  models: string[];
  requiresAuth: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  requiredCapabilities?: LLMCapability[];
  requiredModalities?: LLMModality[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
}

export interface LLMResponse {
  providerId: string;
  model: string;
  text: string;
  finishReason?: "stop" | "length" | "tool_call" | "error";
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface LLMProvider {
  descriptor: LLMProviderDescriptor;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

export interface LLMRouter {
  complete(request: LLMRequest): Promise<LLMResponse>;
}
