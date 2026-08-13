import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryMiningDecisionLedger } from '../src/decision-ledger.ts';
import { evaluateMiningOpportunity } from '../src/economic-decision.ts';

test('MiningDecisionLedger stores an advisory decision once and ignores duplicate decision ids', async () => {
  const ledger = new InMemoryMiningDecisionLedger();
  const record = evaluateMiningOpportunity({
    resourceId: 'bitaxe-001',
    projectedGrossPerHour: 0.12,
    projectedElectricityPerHour: 0.03,
    health: 'healthy',
    confidence: 0.95,
    observedAt: '2026-08-11T00:00:00.000Z',
  });

  await ledger.append(record);
  await ledger.append({ ...record, reasons: ['duplicate attempt'] });

  assert.deepEqual(ledger.list(), [record]);
});
