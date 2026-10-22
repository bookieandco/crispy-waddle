import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import type { ModelProvider } from './router.js';
import { IntelligenceFabric, IntelligenceFabricUnavailableError, type InferenceRecord, type IntelligenceTask } from './intelligence-fabric.js';

const packet: ContextPacket = {
  id: 'ctx-1', purpose: 'audit', relevantMemories: [], patterns: [],
  personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: '2026-09-19T00:00:00.000Z' },
  knowledge: [], constraints: [], excludedContext: [],
};
const task: IntelligenceTask = { id: 'task-1', purpose: 'audit', modalities: ['text'], requiredCapabilities: ['reason'], riskClass: 'standard', privacyClass: 'internal' };
const proposal: DecisionProposal = { id: 'p1', contextId: 'ctx-1', disposition: 'PROCEED', recommendation: 'x', rationale: 'y', evidence: [], uncertainty: [], alternatives: [] };
const ok = (name: string): ModelProvider => ({ name, propose: async () => proposal });
const fail = (name: string): ModelProvider => ({ name, propose: async () => { throw new Error('down'); } });

function makeFabric(primary: ModelProvider, fallbacks: ModelProvider[], records: InferenceRecord[]) {
  return new IntelligenceFabric({
    contextCompiler: { compile: async (t, p) => ({ task: t, packet: p, evidenceIds: ['E-1'], contextHash: 'hash-1' }) },
    routeSelector: { select: async () => ({ provider: primary, fallbackProviders: fallbacks, reason: 'capability-match' }) },
    proposalVerifier: { verify: async (p) => p },
    ledger: { append: async (r) => { records.push(r); } },
    now: () => '2026-09-19T00:00:00.000Z',
    newId: () => 'inf-' + (records.length + 1),
  });
}

test('returns only a verified proposal and records provenance', async () => {
  const records: InferenceRecord[] = [];
  const result = await makeFabric(ok('primary'), [], records).decide(task, packet);
  assert.equal(result.id, 'p1');
  assert.equal(records[0]?.provider, 'primary');
  assert.deepEqual(records[0]?.evidenceIds, ['E-1']);
  assert.equal(records[0]?.outcome, 'succeeded');
});

test('falls through provider chain without granting authority', async () => {
  const records: InferenceRecord[] = [];
  const result = await makeFabric(fail('primary'), [ok('fallback')], records).decide(task, packet);
  assert.equal(result.id, 'p1');
  assert.deepEqual(records.map(r => [r.provider, r.outcome]), [['primary', 'failed'], ['fallback', 'succeeded']]);
});

test('fails closed when every routed provider fails', async () => {
  const records: InferenceRecord[] = [];
  await assert.rejects(() => makeFabric(fail('a'), [fail('b')], records).decide(task, packet), IntelligenceFabricUnavailableError);
  assert.equal(records.length, 2);
  assert.ok(records.every(r => r.outcome === 'failed'));
});
