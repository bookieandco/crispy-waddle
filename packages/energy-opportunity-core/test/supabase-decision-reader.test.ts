import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseMiningDecisionReader } from '../src/supabase-decision-reader.ts';
import type { MiningDecisionRecord } from '../src/economic-decision.ts';

const records: MiningDecisionRecord[] = [
  {
    decisionId: 'd-2', resourceId: 'bitaxe-001', decision: 'run',
    observedAt: '2026-08-11T02:00:00.000Z', projectedGrossPerHour: 0.12,
    projectedElectricityPerHour: 0.07, projectedNetPerHour: 0.05,
    health: 'healthy', confidence: 0.95, reasons: ['profitable'], policyVersion: 'mining-economic-v1',
  },
  {
    decisionId: 'd-1', resourceId: 'bitaxe-001', decision: 'do_not_run',
    observedAt: '2026-08-11T01:00:00.000Z', projectedGrossPerHour: 0.05,
    projectedElectricityPerHour: 0.07, projectedNetPerHour: -0.02,
    health: 'healthy', confidence: 0.95, reasons: ['unprofitable'], policyVersion: 'mining-economic-v1',
  },
];

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    statusText: ok ? 'OK' : 'Unavailable',
  });
}

test('reader returns latest decision and performs GET only', async () => {
  const calls: { url: string; method?: string }[] = [];
  const reader = new SupabaseMiningDecisionReader({
    projectUrl: 'https://example.supabase.co/',
    anonKey: 'anon-test',
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return response([records[0]]);
    },
  });

  const latest = await reader.getLatestDecision('bitaxe-001');
  assert.equal(latest?.state, 'RUN');
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /limit=1/);
  assert.match(calls[0].url, /resource_id=eq\.bitaxe-001/);
});

test('reader returns bounded newest-first history', async () => {
  let requestedUrl = '';
  const reader = new SupabaseMiningDecisionReader({
    projectUrl: 'https://example.supabase.co',
    anonKey: 'anon-test',
    fetchImpl: async input => {
      requestedUrl = String(input);
      return response(records);
    },
  });

  const history = await reader.getDecisionHistory('bitaxe-001', 500);
  assert.deepEqual(history.map(item => item.state), ['RUN', "DON'T RUN"]);
  assert.match(requestedUrl, /limit=100/);
  assert.match(requestedUrl, /order=observed_at\.desc/);
});

test('reader returns null when there is no decision', async () => {
  const reader = new SupabaseMiningDecisionReader({
    projectUrl: 'https://example.supabase.co',
    anonKey: 'anon-test',
    fetchImpl: async () => response([]),
  });
  assert.equal(await reader.getLatestDecision('missing'), null);
});

test('reader propagates Supabase read errors', async () => {
  const reader = new SupabaseMiningDecisionReader({
    projectUrl: 'https://example.supabase.co',
    anonKey: 'anon-test',
    fetchImpl: async () => response({ error: 'database unavailable' }, false),
  });
  await assert.rejects(() => reader.getLatestDecision('bitaxe-001'), /Supabase mining decision read failed: 503 Unavailable/);
});
