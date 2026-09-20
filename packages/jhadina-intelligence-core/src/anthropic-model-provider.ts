import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import { parseDecisionProposal } from './proposal-validation.js';
import { DEFAULT_MODEL_REGISTRY, type ModelRegistry } from './model-registry.js';

export interface AnthropicModelProviderOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Canonical registry id, not a provider-native model id. */
  modelId?: string;
  registry?: ModelRegistry;
}

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL_ID = 'anthropic.reasoning.default';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicModelProvider implements ModelProvider {
  readonly name = 'anthropic';
  constructor(private readonly options: AnthropicModelProviderOptions = {}) {}

  async propose(context: ContextPacket): Promise<DecisionProposal> {
    const apiKey = this.options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('CREDENTIAL_NOT_CONFIGURED:intelligence/anthropic');

    const registry = this.options.registry ?? DEFAULT_MODEL_REGISTRY;
    const registered = registry.require(this.options.modelId ?? DEFAULT_MODEL_ID);
    if (registered.provider !== this.name || registered.lifecycle !== 'active') {
      throw new Error('ANTHROPIC_PROVIDER_MODEL_NOT_ROUTABLE');
    }

    const response = await (this.options.fetchImpl ?? fetch)(`${this.options.baseUrl ?? DEFAULT_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: registered.providerModelId,
        max_tokens: Math.min(1024, registered.maxOutputTokens),
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: JSON.stringify(context) }],
      }),
    });
    if (!response.ok) throw new Error(`ANTHROPIC_PROVIDER_REQUEST_FAILED:${response.status}`);
    const body = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = body.content?.[0]?.text;
    if (typeof text !== 'string') throw new Error('ANTHROPIC_PROVIDER_MALFORMED_RESPONSE');
    return parseDecisionProposal(text, context.id);
  }
}

function buildSystemPrompt(): string {
  return [
    "You are Jhadina's reasoning component, not its authority.",
    'You will be given a ContextPacket (JSON) describing a purpose, goal,',
    'relevant memories, patterns, personality, knowledge, and constraints.',
    'Respond with a single JSON object and nothing else, with exactly these',
    'fields: disposition (one of "PROCEED", "ASK", "DECLINE", "DEFER"),',
    'recommendation (string), rationale (string), evidence (array of',
    '{source, summary} objects), uncertainty (array of strings),',
    'alternatives (array of strings). Do not include any other field.',
    'You are not granting permission and you cannot execute anything —',
    'a separate, deterministic policy and approval system decides what,',
    'if anything, happens with your recommendation.',
  ].join(' ');
}
