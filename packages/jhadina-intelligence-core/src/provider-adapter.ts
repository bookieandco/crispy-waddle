import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import type { ModelRegistry, ModelRegistryEntry } from './model-registry.js';

export interface ProviderNativeResult {
  readonly proposal: DecisionProposal;
  readonly usage?: { readonly inputTokens?: number; readonly outputTokens?: number };
}
export interface ProviderAdapter {
  readonly provider: string;
  invoke(input: { readonly model: ModelRegistryEntry; readonly context: ContextPacket }): Promise<ProviderNativeResult>;
}
/** Proposal-only bridge; never gives model code tool, action, policy or memory authority. */
export class RegistryBackedModelProvider implements ModelProvider {
  readonly name: string;
  constructor(private readonly options: {
    modelId: string; registry: ModelRegistry; adapter: ProviderAdapter;
  }) {
    const model = options.registry.require(options.modelId);
    if (model.provider !== options.adapter.provider) throw new Error('PROVIDER_ADAPTER_MISMATCH');
    this.name = model.id;
  }
  async propose(context: ContextPacket): Promise<DecisionProposal> {
    const model = this.options.registry.require(this.options.modelId);
    if (model.lifecycle !== 'active') throw new Error('PROVIDER_MODEL_NOT_ACTIVE');
    if (model.provider !== this.options.adapter.provider) throw new Error('PROVIDER_ADAPTER_MISMATCH');
    return (await this.options.adapter.invoke({ model, context })).proposal;
  }
}
