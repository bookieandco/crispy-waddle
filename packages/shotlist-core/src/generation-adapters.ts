export interface GenerationContext {
  projectId: string;
  shotId: string;
  prompt: string;
  negativePrompt?: string;
  referenceAssets?: string[];
  characterIds?: string[];
  camera?: Record<string, unknown>;
  continuity?: { priorTakeId?: string; priorClipUri?: string; notes?: string };
  output?: { width?: number; height?: number; fps?: number; durationSec?: number };
}

export interface GeneratedTake {
  takeId: string;
  uri: string;
  provider: string;
  durationSec: number;
  metadata?: Record<string, unknown>;
}

export interface GenerationProviderAdapter {
  name: string;
  capabilities: readonly string[];
  generate(context: GenerationContext): Promise<GeneratedTake>;
}

/**
 * Provider-neutral routing layer. Adapters such as Generative Adapter and MV-Adapter
 * remain optional capabilities; DirectorOS does not depend on their internals.
 */
export class GenerationAdapterRegistry {
  private readonly providers = new Map<string, GenerationProviderAdapter>();

  register(provider: GenerationProviderAdapter): void {
    if (this.providers.has(provider.name)) throw new Error(`Generation provider already registered: ${provider.name}`);
    this.providers.set(provider.name, provider);
  }

  get(name: string): GenerationProviderAdapter {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Generation provider not registered: ${name}`);
    return provider;
  }

  list(): GenerationProviderAdapter[] { return [...this.providers.values()]; }
}

export interface AdapterContextRecipe {
  textContext: string;
  referenceAssets: string[];
  characterIds: string[];
  camera: Record<string, unknown>;
  priorTake?: { takeId: string; uri: string };
}

export interface GenerativeAdapterBridge {
  /** Turns Jhadina's approved story/character context into a dynamic language-model adapter. */
  adapt(context: AdapterContextRecipe): Promise<{ adapterId: string; metadata?: Record<string, unknown> }>;
}

export interface MultiViewAdapterBridge {
  /** Produces consistent reference views for character/product/scene continuity. */
  generateViews(input: {
    prompt?: string;
    referenceImage?: string;
    geometry?: string;
    views: number;
  }): Promise<{ assetUris: string[]; metadata?: Record<string, unknown> }>;
}

export function createGenerativeAdapterProvider(
  adapter: GenerativeAdapterBridge,
  baseProvider: GenerationProviderAdapter,
): GenerationProviderAdapter {
  return {
    name: `${baseProvider.name}+generative-adapter`,
    capabilities: [...baseProvider.capabilities, 'context-adaptation'],
    async generate(context) {
      const adapted = await adapter.adapt({
        textContext: context.prompt,
        referenceAssets: context.referenceAssets ?? [],
        characterIds: context.characterIds ?? [],
        camera: context.camera ?? {},
        priorTake: context.continuity?.priorTakeId && context.continuity.priorClipUri
          ? { takeId: context.continuity.priorTakeId, uri: context.continuity.priorClipUri }
          : undefined,
      });
      return baseProvider.generate({
        ...context,
        prompt: `${context.prompt}\n[generated-adapter:${adapted.adapterId}]`,
      });
    },
  };
}

export function createMultiViewContinuityProvider(
  multiview: MultiViewAdapterBridge,
  baseProvider: GenerationProviderAdapter,
): GenerationProviderAdapter {
  return {
    name: `${baseProvider.name}+mv-adapter`,
    capabilities: [...baseProvider.capabilities, 'multi-view-consistency'],
    async generate(context) {
      const views = await multiview.generateViews({
        prompt: context.prompt,
        referenceImage: context.referenceAssets?.[0],
        views: 6,
      });
      return baseProvider.generate({
        ...context,
        referenceAssets: [...(context.referenceAssets ?? []), ...views.assetUris],
      });
    },
  };
}
