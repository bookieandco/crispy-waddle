import type { DecisionProposal } from '@jhadina/core-spine';
import type { ModelRegistryEntry } from './model-registry.js';
import type { ProviderAdapter, ProviderNativeResult } from './provider-adapter.js';
import { parseDecisionProposal } from './proposal-validation.js';

export interface LocalInferenceTransport {
  generate(input: {
    readonly model: string;
    readonly system: string;
    readonly prompt: string;
    readonly maxOutputTokens: number;
  }): Promise<{ readonly text: string; readonly inputTokens?: number; readonly outputTokens?: number }>;
}

/**
 * Provider-neutral local/offline adapter. Transport may be Ollama, llama.cpp,
 * MLX, an on-device runtime, or a homebase worker; this layer does not assume
 * network access and has no action/tool authority.
 */
export class LocalModelProviderAdapter implements ProviderAdapter {
  readonly provider = 'local';
  constructor(private readonly transport: LocalInferenceTransport) {}

  async invoke(input: { model: ModelRegistryEntry; context: any }): Promise<ProviderNativeResult> {
    if (!input.model.local || input.model.provider !== this.provider) throw new Error('LOCAL_PROVIDER_MODEL_REQUIRED');
    const prompt = JSON.stringify(input.context);
    const result = await this.transport.generate({
      model: input.model.providerModelId,
      system: 'You are a replaceable Jhadina reasoning component. Return only a DecisionProposal JSON object. You cannot approve actions, grant capabilities, execute tools, or write durable memory. Cite only evidence IDs present in the supplied context.',
      prompt,
      maxOutputTokens: input.model.maxOutputTokens,
    });
    return {
      proposal: parseDecisionProposal(result.text, input.context.id),
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }
}

export function localModelEntry(input: {
  id: string; providerModelId: string; version: string;
  contextWindowTokens: number; maxOutputTokens: number;
}): ModelRegistryEntry {
  return Object.freeze({
    id: input.id, provider: 'local', providerModelId: input.providerModelId,
    modalities: Object.freeze(['text']), capabilities: Object.freeze(['reason','summarize','classify','extract','plan','critique','verify']),
    maxPrivacyClass: 'restricted', contextWindowTokens: input.contextWindowTokens,
    maxOutputTokens: input.maxOutputTokens, costClass: 'free', latencyClass: 'standard',
    lifecycle: 'active', local: true, version: input.version,
  });
}
