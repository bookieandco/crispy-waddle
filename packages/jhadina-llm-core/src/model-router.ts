import type { ModelCapability, ModelProvider, ModelRequest, ModelResponse, ModelRouter } from "./llm-contract";

export class DefaultModelRouter implements ModelRouter {
  constructor(private readonly providers: ModelProvider[]) {}

  async route(request: ModelRequest): Promise<ModelResponse> {
    const candidates = this.providers.filter((provider) =>
      (request.capabilities ?? []).every((capability: ModelCapability) => provider.supports(capability)),
    );

    if (candidates.length === 0) {
      throw new Error("No model provider satisfies the requested capabilities.");
    }

    const ordered = request.modelPreference
      ? [...candidates].sort((a, b) => Number(a.id !== request.modelPreference) - Number(b.id !== request.modelPreference))
      : candidates;

    let lastError: unknown;
    for (const provider of ordered) {
      try {
        return await provider.generate(request);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("All model providers failed.");
  }
}
