import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import { parseDecisionProposal } from './proposal-validation.js';
import { buildSystemPrompt } from './anthropic-model-provider.js';

export interface GeminiModelProviderOptions {
  /** Test injection only. Production reads the existing server-side key lazily. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Optional governed reasoning provider; identical ContextPacket, prompt and
 * proposal parser as Anthropic. Never grants capabilities or mutates Memory.
 * A bad Gemini response is a normal IntelligenceRouter fallback event.
 */
export class GeminiModelProvider implements ModelProvider {
  readonly name = 'gemini';

  constructor(private readonly options: GeminiModelProviderOptions = {}) {}

  async propose(context: ContextPacket): Promise<DecisionProposal> {
    const apiKey = this.options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('CREDENTIAL_NOT_CONFIGURED:intelligence/gemini');

    const artifacts = context.artifacts ?? [];
    const contextForText = {
      ...context,
      artifacts: artifacts.map(({ base64: _base64, text: _text, ...artifact }) => artifact),
    };
    const textArtifacts = artifacts
      .filter((artifact) => artifact.kind === 'text' && typeof artifact.text === 'string')
      .map((artifact) => `\n\n[EPHEMERAL ARTIFACT: ${artifact.name ?? artifact.id} | ${artifact.mimeType}]\n${artifact.text}`)
      .join('');
    const imageParts = artifacts
      .filter((artifact) => (artifact.kind === 'image' || artifact.kind === 'screen') && artifact.base64)
      .map((artifact) => ({
        inlineData: { mimeType: artifact.mimeType, data: artifact.base64! },
      }));
    const model = this.options.model ?? process.env.JHADINA_GEMINI_REASONING_MODEL ?? 'gemini-2.5-flash-lite';
    const baseUrl = this.options.baseUrl ?? DEFAULT_URL;

    const response = await (this.options.fetchImpl ?? fetch)(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
          contents: [{
            role: 'user',
            parts: [
              ...imageParts,
              { text: JSON.stringify(contextForText) + textArtifacts },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 1200,
            temperature: 0.2,
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`GEMINI_PROVIDER_REQUEST_FAILED:${response.status}`);
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!rawText) throw new Error('GEMINI_PROVIDER_MALFORMED_RESPONSE');
    return parseDecisionProposal(rawText, context.id);
  }
}
