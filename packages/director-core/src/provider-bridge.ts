import type { TakeRequest } from './generation-orchestrator.js';

export type GenerationMedia = { kind: 'video' | 'image'; uri: string; thumbnailUri?: string; durationSeconds?: number; width?: number; height?: number; mimeType?: string };

export type GenerationResult = { provider: string; providerJobId?: string; media: GenerationMedia; metadata?: Record<string, unknown> };

export interface GenerationProvider {
  readonly id: string;
  generate(request: TakeRequest & { variation?: string }): Promise<GenerationResult>;
}

export class GenerationProviderRegistry {
  private readonly providers = new Map<string, GenerationProvider>();
  register(provider: GenerationProvider) { this.providers.set(provider.id, provider); }
  get(id?: string) { return id ? this.providers.get(id) : this.providers.values().next().value; }
  async generate(providerId: string | undefined, request: TakeRequest & { variation?: string }) {
    const provider = this.get(providerId);
    if (!provider) throw new Error('No generation provider is configured');
    return provider.generate(request);
  }
}

export function createHttpGenerationProvider(input: { id: string; endpoint: string; apiKey?: string }): GenerationProvider {
  return {
    id: input.id,
    async generate(request) {
      const response = await fetch(input.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(input.apiKey ? { authorization: `Bearer ${input.apiKey}` } : {}) }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`Generation provider ${input.id} returned ${response.status}`);
      return await response.json() as GenerationResult;
    },
  };
}
