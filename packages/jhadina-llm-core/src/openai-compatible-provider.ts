import type { LLMContentPart, LLMProvider, LLMRequest, LLMResponse } from "./llm-contract";

export interface OpenAICompatibleProviderOptions {
  id: string;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  modalities?: LLMProvider["descriptor"]["modalities"];
  capabilities?: LLMProvider["descriptor"]["capabilities"];
}

interface ChatCompletionPayload {
  choices?: Array<{ message?: { content?: string }; finish_reason?: LLMResponse["finishReason"] }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

/** Adapter for OpenAI-compatible chat APIs. Credentials stay outside command/action core. */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly descriptor;

  constructor(private readonly options: OpenAICompatibleProviderOptions) {
    this.descriptor = {
      id: options.id,
      displayName: options.displayName,
      modalities: options.modalities ?? ["text"],
      capabilities: options.capabilities ?? ["chat", "coding", "reasoning", "tool_calling", "structured_output"],
      models: options.models,
      requiresAuth: Boolean(options.apiKey),
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (request.stream) {
      throw new Error("OpenAICompatibleProvider currently supports non-streaming completion only.");
    }

    const model = request.model ?? this.options.models[0];
    if (!model) throw new Error(`No model configured for provider ${this.options.id}.`);

    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: normalizeContent(message.content),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM provider ${this.options.id} returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as ChatCompletionPayload;
    const choice = payload.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== "string") {
      throw new Error(`LLM provider ${this.options.id} returned no message content.`);
    }

    return {
      providerId: this.options.id,
      model: payload.model ?? model,
      text,
      finishReason: choice?.finish_reason,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      },
    };
  }
}

function normalizeContent(content: string | LLMContentPart[]): unknown {
  if (typeof content === "string") return content;

  return content.map((part) => {
    switch (part.type) {
      case "text":
        return part;
      case "image_url":
        return { type: "image_url", image_url: { url: part.url } };
      case "audio_url":
        return { type: "audio_url", audio_url: { url: part.url } };
    }
  });
}
