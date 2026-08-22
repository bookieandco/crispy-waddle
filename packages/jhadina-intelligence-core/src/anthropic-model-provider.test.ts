import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket } from '@jhadina/core-spine';
import { AnthropicModelProvider } from './anthropic-model-provider.js';

function baseContext(): ContextPacket {
  return {
    id: 'ctx-1',
    purpose: 'test',
    relevantMemories: [],
    patterns: [],
    personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: new Date().toISOString() },
    knowledge: [],
    constraints: [],
    excludedContext: [],
  };
}

function fakeFetchReturning(body: unknown, status = 200): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response) as typeof fetch;
}

test('CREDENTIAL_NOT_CONFIGURED when no API key is available — never silently proceeds', async () => {
  const provider = new AnthropicModelProvider({ fetchImpl: fakeFetchReturning({}) });
  await assert.rejects(
    () => provider.propose(baseContext()),
    /CREDENTIAL_NOT_CONFIGURED:intelligence\/anthropic/,
  );
});

test('parses a real Anthropic Messages API response shape into a DecisionProposal', async () => {
  const responseText = JSON.stringify({
    disposition: 'PROCEED',
    recommendation: 'note the preference',
    rationale: 'explicit preference statement',
    evidence: [],
    uncertainty: [],
    alternatives: [],
  });
  const fetchImpl = fakeFetchReturning({ content: [{ type: 'text', text: responseText }] });

  const provider = new AnthropicModelProvider({ apiKey: 'test-key', fetchImpl });
  const proposal = await provider.propose(baseContext());

  assert.equal(proposal.disposition, 'PROCEED');
  assert.equal(proposal.contextId, 'ctx-1');
});

test('an HTTP failure from the provider is a normal, catchable rejection', async () => {
  const provider = new AnthropicModelProvider({
    apiKey: 'test-key',
    fetchImpl: fakeFetchReturning({ error: 'rate limited' }, 429),
  });
  await assert.rejects(() => provider.propose(baseContext()), /ANTHROPIC_PROVIDER_REQUEST_FAILED:429/);
});

test('a malformed (non-text) success response is rejected rather than passed through', async () => {
  const provider = new AnthropicModelProvider({
    apiKey: 'test-key',
    fetchImpl: fakeFetchReturning({ content: [{ type: 'tool_use' }] }),
  });
  await assert.rejects(() => provider.propose(baseContext()), /ANTHROPIC_PROVIDER_MALFORMED_RESPONSE/);
});

test('sends the API key only via the x-api-key header, never inside the request body', async () => {
  let capturedHeaders: Record<string, string> | undefined;
  let capturedBody: string | undefined;
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    capturedHeaders = init?.headers as Record<string, string>;
    capturedBody = init?.body as string;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({ disposition: 'ASK', recommendation: 'x', rationale: 'y' }),
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  const provider = new AnthropicModelProvider({ apiKey: 'super-secret-key', fetchImpl });
  await provider.propose(baseContext());

  assert.equal(capturedHeaders?.['x-api-key'], 'super-secret-key');
  assert.equal(capturedBody?.includes('super-secret-key'), false);
});
