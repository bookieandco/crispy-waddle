export type LlmTask =
  | "conversation"
  | "reasoning"
  | "coding"
  | "research"
  | "search"
  | "creative"
  | "learning"
  | "planning"
  | "review";

export type ModelCapability =
  | "text"
  | "vision"
  | "audio"
  | "image-generation"
  | "video-generation"
  | "tool-use"
  | "code"
  | "long-context";

export interface ModelRequest {
  task: LlmTask;
  messages: LlmMessage[];
  capabilities?: ModelCapability[];
  modelPreference?: string;
  maxLatencyMs?: number;
  maxCost?: number;
  metadata?: Record<string, unknown>;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
}

export interface ModelResponse {
  provider: string;
  model: string;
  content: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelProvider {
  readonly id: string;
  supports(capability: ModelCapability): boolean;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export interface ModelRouter {
  route(request: ModelRequest): Promise<ModelResponse>;
}

export interface Conversation {
  id: string;
  messages: LlmMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalityContext {
  identity?: string;
  preferences?: unknown[];
  patterns?: unknown[];
  experiences?: unknown[];
  values?: unknown[];
}

export interface ContextAssembler {
  assemble(input: {
    conversation: Conversation;
    task: LlmTask;
    personality?: PersonalityContext;
    toolContext?: unknown;
  }): Promise<LlmMessage[]>;
}
