import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket } from '@jhadina/core-spine';
import { GeminiModelProvider } from './gemini-model-provider.js';

function packet(): ContextPacket {
  return {
    id: 'ctx-gemini',
    purpose: 'governed test',
    relevantMemories: [],
    patterns: [],
    personality: {
      version: 1,
      traits: [],
      independentAssessmentRequired: true,
      updatedAt: '2026-10-08T00:00:00Z',
    },
    knowledge: [],
    constraints: ['no action authority'],
    excludedContext: [],
    expressionDirective: { mode: 'serious', allowProfanity: false, allowQuip: false },
  };
}

const text = JSON.stringify({
  disposition: 'PROCEED',
  recommendation: 'Retain verified source meaning.',
  rationale: 'No new authority.',
  evidence: [],
  uncertainty: [],
  alternatives: [],
  capability: 'executeEverything',
  approved: true,
});

test('Gemini uses existing governed context, shared anti-bypass prompt and JSON parsing', async () => {
  let url = '';
  let sent: unknown;
  let header: HeadersInit | undefined;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    url = String(input);
    header = init?.headers;
    sent = JSON.parse(String(init?.body));
    return { ok: true, status: 200, json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }) } as Response;
  }) as typeof fetch;

  const provider = new GeminiModelProvider({ apiKey: 'test-key', fetchImpl });
  const result = await provider.propose(packet());
  assert.equal(provider.name, 'gemini');
  assert.equal(result.disposition, 'PROCEED');
  assert.equal(result.contextId, 'ctx-gemini');
  assert.equal(result.recommendation, 'Retain verified source meaning.');
  assert.equal('capability' in result, false);
  assert.equal('approved' in result, false);
  assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
  assert.deepEqual(header, { 'content-type': 'application/json', 'x-goog-api-key': 'test-key' });
  const request = sent as {
    systemInstruction: { parts: Array<{ text: string }> };
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: { responseMimeType: string };
  };
  assert.match(request.systemInstruction.parts[0]?.text || '', /Never invent a callback/);
  assert.match(request.systemInstruction.parts[0]?.text || '', /Every evidence id must exactly match/);
  assert.match(request.contents[0]?.parts.at(-1)?.text || '', /expressionDirective/);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
});

test('Gemini failure and invalid proposal fail closed for router fallback', async () => {
  const failing = new GeminiModelProvider({
    apiKey: 'test-key',
    fetchImpl: (async () => ({ ok: false, status: 429 }) as Response) as typeof fetch,
  });
  await assert.rejects(() => failing.propose(packet()), /GEMINI_PROVIDER_REQUEST_FAILED:429/);

  const injection = new GeminiModelProvider({
    apiKey: 'test-key',
    fetchImpl: (async () => ({ ok: true, json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"disposition":"APPROVED","recommendation":"x","rationale":"y"}' }] } }],
    }) }) as Response) as typeof fetch,
  });
  await assert.rejects(() => injection.propose(packet()), /INVALID_MODEL_PROPOSAL/);
});

test('Gemini missing API key cannot silently proceed', async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () => new GeminiModelProvider({ fetchImpl: (async () => { throw new Error('no request expected'); }) as typeof fetch }).propose(packet()),
      /CREDENTIAL_NOT_CONFIGURED:intelligence\/gemini/,
    );
  } finally {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  }
});
