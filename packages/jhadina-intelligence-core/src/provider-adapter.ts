import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import type { ModelRegistry, ModelRegistryEntry } from './model-registry.js';

export interface ProviderUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface ProviderInvocationMetadata {
  readonly canonicalModelId: string;
  readonly provider: string;
  readonly providerModelId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly usage?: ProviderUsage;
  readonly providerRequestId?: string;
}

export interface ProviderInvocationResult {
  readonly proposal: DecisionProposal;
  readonly metadata: ProviderInvocationMetadata;
}

export interface ProviderNativeResult {
  readonly proposal: DecisionProposal;
  readonly usage?: ProviderUsage;
  readonly providerRequestId?: string;
}

export interface ProviderAdapter {
  readonly provider: string;
  invoke(input: {
    readonly model: ModelRegistryEntry;
    readonly context: ContextPacket;
  }): Promise<ProviderNativeResult>;
}

export interface RegistryBackedModelProviderOptions {
  readonly modelId: string;
  readonly registry: ModelRegistry;
  readonly adapter: ProviderAdapter;
  readonly now?: () => Date;
  readonly onInvocation?: (result: ProviderInvocationMetadata) => void | Promise<void>;
}

/**
 * Converts a provider-native adapter into the existing authority-free
 * ModelProvider contract. The adapter can infer only; it cannot grant a
 * capability, approve an action, execute a tool, or commit memory.
 */
export class RegistryBackedModelProvider implements ModelProvider {
  readonly name: string;

  constructor(private readonly options: RegistryBackedModelProviderOptions) {
    const model = options.registry.require(options.modelId);
    if (model.provider !== options.adapter.provider) {
      throw new Error(`PROVIDER_ADAPTER_MISMATCH:${options.modelId}`);
    }
    this.name = options.modelId;
  }

  async propose(context: ContextPacket): Promise<DecisionProposal> {
    return (await this.invoke(context)).proposal;
  }

  async invoke(context: ContextPacket): Promise<ProviderInvocationResult> {
    const model = this.options.registry.require(this.options.modelId);
    if (model.lifecycle !== 'active') throw new Error(`PROVIDER_MODEL_NOT_ACTIVE:${model.id}`);
    if (model.provider !== this.options.adapter.provider) throw new Error(`PROVIDER_ADAPTER_MISMATCH:${model.id}`);

    const start = this.options.now?.() ?? new Date();
    let native: ProviderNativeResult;
    try {
      native = await this.options.adapter.invoke({ model, context });
    } catch (cause) {
      throw new ProviderInvocationError(model.id, model.provider, cause);
    }
    const end = this.options.now?.() ?? new Date();
    const metadata: ProviderInvocationMetadata = Object.freeze({
      canonicalModelId: model.id,
      provider: model.provider,
      providerModelId: model.providerModelId,
      startedAt: start.toISOString(),
      completedAt: end.toISOString(),
      latencyMs: Math.max(0, end.getTime() - start.getTime()),
      usage: native.usage,
      providerRequestId: native.providerRequestId,
    });
    await this.options.onInvocation?.(metadata);
    return { proposal: native.proposal, metadata };
  }
}

export class ProviderInvocationError extends Error {
  constructor(
    public readonly canonicalModelId: string,
    public readonly provider: string,
    public readonly cause: unknown,
  ) {
    super(`PROVIDER_INVOCATION_FAILED:${canonicalModelId}`);
    this.name = 'ProviderInvocationError';
  }
}
