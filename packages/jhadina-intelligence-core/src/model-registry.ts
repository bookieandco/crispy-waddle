import type {
  IntelligenceCapability,
  IntelligenceModality,
  IntelligencePrivacyClass,
} from './intelligence-fabric.js';

export type ModelLifecycle = 'active' | 'degraded' | 'disabled' | 'retired';
export type ModelCostClass = 'free' | 'low' | 'medium' | 'high';
export type ModelLatencyClass = 'fast' | 'standard' | 'slow';

export interface ModelRegistryEntry {
  readonly id: string;
  readonly provider: string;
  readonly providerModelId: string;
  readonly modalities: readonly IntelligenceModality[];
  readonly capabilities: readonly IntelligenceCapability[];
  readonly maxPrivacyClass: IntelligencePrivacyClass;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly costClass: ModelCostClass;
  readonly latencyClass: ModelLatencyClass;
  readonly lifecycle: ModelLifecycle;
  readonly local: boolean;
  readonly version: number;
}

export interface ModelRegistrySnapshot {
  readonly version: number;
  readonly models: readonly ModelRegistryEntry[];
}

const PRIVACY_RANK: Record<IntelligencePrivacyClass, number> = {
  public: 0,
  internal: 1,
  sensitive: 2,
  restricted: 3,
};

export class ModelRegistry {
  private readonly byId: ReadonlyMap<string, ModelRegistryEntry>;

  constructor(readonly snapshot: ModelRegistrySnapshot) {
    if (!Number.isInteger(snapshot.version) || snapshot.version < 1) {
      throw new Error('MODEL_REGISTRY_INVALID_VERSION');
    }

    const map = new Map<string, ModelRegistryEntry>();
    for (const model of snapshot.models) {
      validateEntry(model);
      if (map.has(model.id)) throw new Error(`MODEL_REGISTRY_DUPLICATE_ID:${model.id}`);
      map.set(model.id, Object.freeze({ ...model }));
    }
    this.byId = map;
  }

  get(id: string): ModelRegistryEntry | undefined {
    return this.byId.get(id);
  }

  require(id: string): ModelRegistryEntry {
    const model = this.get(id);
    if (!model) throw new Error(`MODEL_REGISTRY_UNKNOWN_MODEL:${id}`);
    return model;
  }

  eligible(input: {
    modalities: readonly IntelligenceModality[];
    capabilities: readonly IntelligenceCapability[];
    privacyClass: IntelligencePrivacyClass;
    minimumContextWindowTokens?: number;
  }): ModelRegistryEntry[] {
    return [...this.byId.values()].filter((model) =>
      model.lifecycle === 'active' &&
      input.modalities.every((value) => model.modalities.includes(value)) &&
      input.capabilities.every((value) => model.capabilities.includes(value)) &&
      PRIVACY_RANK[input.privacyClass] <= PRIVACY_RANK[model.maxPrivacyClass] &&
      model.contextWindowTokens >= (input.minimumContextWindowTokens ?? 0),
    );
  }
}

function validateEntry(model: ModelRegistryEntry): void {
  if (!model.id.trim() || !model.provider.trim() || !model.providerModelId.trim()) {
    throw new Error('MODEL_REGISTRY_INVALID_IDENTITY');
  }
  if (!Number.isInteger(model.contextWindowTokens) || model.contextWindowTokens < 1) {
    throw new Error(`MODEL_REGISTRY_INVALID_CONTEXT_WINDOW:${model.id}`);
  }
  if (!Number.isInteger(model.maxOutputTokens) || model.maxOutputTokens < 1) {
    throw new Error(`MODEL_REGISTRY_INVALID_OUTPUT_LIMIT:${model.id}`);
  }
  if (!Number.isInteger(model.version) || model.version < 1) {
    throw new Error(`MODEL_REGISTRY_INVALID_MODEL_VERSION:${model.id}`);
  }
  if (new Set(model.modalities).size !== model.modalities.length ||
      new Set(model.capabilities).size !== model.capabilities.length) {
    throw new Error(`MODEL_REGISTRY_DUPLICATE_CAPABILITY:${model.id}`);
  }
}

/**
 * Seed only what the repo actually has a provider adapter for today.
 * New providers/models must be registered explicitly rather than silently
 * becoming routable because a credential happens to exist.
 */
export const DEFAULT_MODEL_REGISTRY = new ModelRegistry({
  version: 1,
  models: [{
    id: 'anthropic.reasoning.default',
    provider: 'anthropic',
    providerModelId: 'claude-sonnet-4-5-20250929',
    modalities: ['text'],
    capabilities: ['reason', 'summarize', 'classify', 'extract', 'plan', 'critique', 'verify'],
    maxPrivacyClass: 'sensitive',
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    costClass: 'medium',
    latencyClass: 'standard',
    lifecycle: 'active',
    local: false,
    version: 1,
  }],
});
