import type { ContextPacket } from '@jhadina/core-spine';
import type { IntelligenceCapability, IntelligenceModality } from './intelligence-fabric.js';
import type { ModelRegistryEntry } from './model-registry.js';
import type { ProviderAdapter, ProviderNativeResult } from './provider-adapter.js';
import { parseDecisionProposal } from './proposal-validation.js';

/**
 * No HTTP client, socket, CLI, process spawn or credentials. An operator-provided
 * transport must be independently commissioned and proven local before enablement.
 * Merely declaring a local transport is NOT a residency or privacy attestation.
 */
export interface LocalInferenceTransport {
  generate(input: {
    readonly model: string; readonly system: string;
    readonly prompt: string; readonly maxOutputTokens: number;
  }): Promise<{ readonly text: string; readonly inputTokens?: number; readonly outputTokens?: number }>;
}
export class LocalModelProviderAdapter implements ProviderAdapter {
  readonly provider = 'local';
  constructor(private readonly transport: LocalInferenceTransport) {}
  async invoke(input: { readonly model: ModelRegistryEntry; readonly context: ContextPacket }): Promise<ProviderNativeResult> {
    const { model, context } = input;
    if (!model.local || model.provider !== 'local') throw new Error('LOCAL_PROVIDER_MODEL_REQUIRED');
    if (model.lifecycle !== 'active') throw new Error('LOCAL_PROVIDER_DISABLED');
    if (!context.id?.trim()) throw new Error('LOCAL_PROVIDER_CONTEXT_REQUIRED');
    const prompt = JSON.stringify(context);
    if (prompt.length > 1_000_000) throw new Error('LOCAL_PROVIDER_CONTEXT_TOO_LARGE');
    const result = await this.transport.generate({
      model: model.providerModelId,
      system: 'You are an untrusted Jhadina reasoning component. Return DecisionProposal JSON only. No tool execution, permission grants, durable memory edits, or approvals. Cite only supplied evidence IDs.',
      prompt,
      maxOutputTokens: model.maxOutputTokens,
    });
    return { proposal: parseDecisionProposal(result.text, context.id),
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } };
  }
}
export function localModelEntry(input: {
  id: string; providerModelId: string; version: number;
  contextWindowTokens: number; maxOutputTokens: number;
  /** Explicit source-test opt-in, NOT runtime commissioning. */
  enabled?: boolean;
}): ModelRegistryEntry {
  const modalities: IntelligenceModality[] = ['text'];
  const capabilities: IntelligenceCapability[] = ['reason', 'summarize', 'classify', 'extract', 'plan', 'critique', 'verify'];
  return Object.freeze({
    id: input.id, provider: 'local', providerModelId: input.providerModelId,
    modalities, capabilities, maxPrivacyClass: 'restricted',
    contextWindowTokens: input.contextWindowTokens, maxOutputTokens: input.maxOutputTokens,
    costClass: 'free', latencyClass: 'standard',
    lifecycle: input.enabled === true ? 'active' : 'disabled',
    local: true, version: input.version,
  });
}
