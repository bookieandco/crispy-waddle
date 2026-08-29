import type { LLMProvider, LLMRequest, LLMResponse, LLMRouter } from "./llm-contract";

export class CapabilityAwareLLMRouter implements LLMRouter {
  constructor(private readonly providers: LLMProvider[]) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const candidates = this.providers.filter((provider) =>
      (request.requiredCapabilities ?? []).every((capability) =>
        provider.descriptor.capabilities.includes(capability),
      ) &&
      (request.requiredModalities ?? []).every((modality) =>
        provider.descriptor.modalities.includes(modality),
      ) &&
      (!request.model || provider.descriptor.models.includes(request.model)),
    );

    if (candidates.length === 0) {
      throw new Error("No LLM provider satisfies the requested model, capability, or modality constraints.");
    }

    let lastError: unknown;
    for (const provider of candidates) {
      try {
        return await provider.complete(request);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error("All eligible LLM providers failed.", { cause: lastError });
  }
}
