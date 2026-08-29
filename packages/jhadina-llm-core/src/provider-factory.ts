import type { LLMProvider } from "./llm-contract";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import type { LLMProviderConfig, LLMProviderConfigSource } from "./provider-config";

export interface LLMProviderFactory {
  create(id: string): LLMProvider | undefined;
}

export class ConfiguredLLMProviderFactory implements LLMProviderFactory {
  constructor(private readonly source: LLMProviderConfigSource) {}

  create(id: string): LLMProvider | undefined {
    const config = this.source.get(id);
    return config ? createOpenAICompatibleProvider(config) : undefined;
  }
}

function createOpenAICompatibleProvider(config: LLMProviderConfig): LLMProvider {
  return new OpenAICompatibleProvider({
    id: config.id,
    displayName: config.displayName,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    models: [config.model],
  });
}
