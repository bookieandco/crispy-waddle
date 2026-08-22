import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import { parseDecisionProposal } from './proposal-validation.js';

/**
 * The one real model provider Step 3 wires in. A raw `fetch` call against
 * Anthropic's Messages API, matching this repo's established pattern for
 * external HTTP providers (Commerce's stripe-sandbox-provider.ts, Money's
 * PlaidReadOnlyAdapter) rather than adding a new SDK dependency.
 *
 * Credential resolution is lazy (read inside `propose()`, not the
 * constructor) — the same fix pupsonstuff's lib/ai.ts already made for
 * OPENAI_API_KEY: reading an unset env var at module load / construction
 * time would throw during import rather than surfacing the intended,
 * ordinary "not configured" failure at call time. That matters here
 * specifically because IntelligenceRouter's fallback path depends on
 * provider failures being ordinary `propose()`-time rejections it can
 * catch — a constructor-time throw would happen before the router ever
 * gets a chance to fall back.
 */

export interface AnthropicModelProviderOptions {
  /** Test-only escape hatch. Real composition code should never set this
   * — see production-model-provider.ts in apps/jhadina-web, which reads
   * ANTHROPIC_API_KEY itself and leaves this unset. */
  apiKey?: string;
  /** Test-only escape hatch. Defaults to the real Anthropic API. */
  fetchImpl?: typeof fetch;
  /** Test-only escape hatch. Defaults to the real Anthropic API. */
  baseUrl?: string;
  model?: string;
}

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicModelProvider implements ModelProvider {
  readonly name = 'anthropic';

  constructor(private readonly options: AnthropicModelProviderOptions = {}) {}

  async propose(context: ContextPacket): Promise<DecisionProposal> {
    const apiKey = this.options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('CREDENTIAL_NOT_CONFIGURED:intelligence/anthropic');
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const baseUrl = this.options.baseUrl ?? DEFAULT_BASE_URL;
    const model = this.options.model ?? DEFAULT_MODEL;

    const response = await fetchImpl(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: JSON.stringify(context) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`ANTHROPIC_PROVIDER_REQUEST_FAILED:${response.status}`);
    }

    const body = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = body.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('ANTHROPIC_PROVIDER_MALFORMED_RESPONSE');
    }

    return parseDecisionProposal(text, context.id);
  }
}

/**
 * Instructs the model to reason like the DecisionPort it's standing in
 * for, and to answer only in the exact JSON shape proposal-validation.ts
 * parses. The model is never told about capabilities, policy, or
 * execution — it has no vocabulary for "approved" or "execute" to even
 * attempt smuggling, because this prompt never introduces those concepts.
 */
function buildSystemPrompt(): string {
  return [
    'You are Jhadina\'s reasoning component, not its authority.',
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
