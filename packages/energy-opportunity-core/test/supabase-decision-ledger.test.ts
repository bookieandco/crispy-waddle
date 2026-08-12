import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseMiningDecisionLedger } from '../src/supabase-decision-ledger.ts';
import type { MiningDecisionRecord } from '../src/economic-decision.ts';

const record: MiningDecisionRecord = {
  decisionId: 'mining-decision:bitaxe-001:2026-08-11T23:00:00.000Z',
  resourceId: 'bitaxe-001',
  decision: 'run',
  observedAt: '2026-08-11T23:00:00.000Z',
  projectedGrossPerHour: 0.12,
  projectedElectricityPerHour: 0.03,
  projectedNetPerHour: 0.09,
  health: 'healthy',
  confidence: 0.91,
  reasons: ['projected net economics satisfy policy'],
  policyVersion: 'mining-economic-v1',
};

test('SupabaseMiningDecisionLedger posts an idempotent decision payload without exposing credentials in the body', async () => {
  let request: Request | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(null, { status: 201 });
  };

  const ledger = new SupabaseMiningDecisionLedger({
    projectUrl: 'https://example.supabase.co/',
    serviceRoleKey: 'test-service-role-key',
    fetchImpl,
  });

  await ledger.append(record);

  assert.equal(request?.url, 'https://example.supabase.co/rest/v1/jhadina_mining_decisions');
  assert.equal(request?.method, 'POST');
  assert.match(request?.headers.get('prefer') ?? '', /resolution=ignore-duplicates/);
  assert.equal(request?.headers.get('authorization'), 'Bearer test-service-role-key');

  const body = await request!.json();
  assert.deepEqual(body, {
    decision_id: record.decisionId,
    resource_id: record.resourceId,
    decision: record.decision,
    observed_at: record.observedAt,
    projected_gross_per_hour: record.projectedGrossPerHour,
    projected_electricity_per_hour: record.projectedElectricityPerHour,
    projected_net_per_hour: record.projectedNetPerHour,
    health: record.health,
    confidence: record.confidence,
    reasons: record.reasons,
    policy_version: record.policyVersion,
  });
  assert.doesNotMatch(JSON.stringify(body), /test-service-role-key/);
});

test('SupabaseMiningDecisionLedger surfaces Supabase failures', async () => {
  const fetchImpl: typeof fetch = async () => new Response('bad request', { status: 400, statusText: 'Bad Request' });
  const ledger = new SupabaseMiningDecisionLedger({
    projectUrl: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl,
  });

  await assert.rejects(
    ledger.append(record),
    /Supabase mining decision insert failed: 400 Bad Request/,
  );
});
