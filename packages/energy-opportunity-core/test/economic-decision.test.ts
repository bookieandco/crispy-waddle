import { strict as assert } from 'node:assert';
import { evaluateMiningOpportunity } from '../src/economic-decision.ts';

const base = {
  resourceId: 'bitaxe-001',
  projectedGrossPerHour: 0.12,
  projectedElectricityPerHour: 0.07,
  health: 'healthy' as const,
  confidence: 0.9,
  observedAt: '2026-08-11T00:00:00.000Z',
};

const run = evaluateMiningOpportunity(base);
assert.equal(run.decision, 'run');
assert.equal(run.projectedNetPerHour, 0.05);

const badEconomics = evaluateMiningOpportunity({ ...base, projectedElectricityPerHour: 0.13 });
assert.equal(badEconomics.decision, 'do_not_run');

const unknown = evaluateMiningOpportunity({ ...base, projectedElectricityPerHour: null });
assert.equal(unknown.decision, 'insufficient_data');

const lowConfidence = evaluateMiningOpportunity({ ...base, confidence: 0.2 });
assert.equal(lowConfidence.decision, 'insufficient_data');

const offline = evaluateMiningOpportunity({ ...base, health: 'offline' });
assert.equal(offline.decision, 'insufficient_data');
