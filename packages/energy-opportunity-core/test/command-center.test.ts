import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMiningCommandCenterCard } from '../src/command-center.ts';
import { evaluateMiningOpportunity } from '../src/economic-decision.ts';

const base = {
  resourceId: 'bitaxe-001',
  projectedGrossPerHour: 0.12,
  projectedElectricityPerHour: 0.03,
  health: 'healthy' as const,
  confidence: 0.95,
  observedAt: '2026-08-11T00:00:00.000Z',
};

test('maps a profitable decision to a RUN command-center card', () => {
  const record = evaluateMiningOpportunity(base);
  const card = buildMiningCommandCenterCard(record);

  assert.equal(card.decision, 'RUN');
  assert.equal(card.resourceId, 'bitaxe-001');
  assert.equal(card.projectedGrossPerHour, 0.12);
  assert.equal(card.projectedElectricityPerHour, 0.03);
  assert.ok(card.projectedNetPerHour !== null);
});

test('maps incomplete economics to INSUFFICIENT DATA', () => {
  const record = evaluateMiningOpportunity({ ...base, projectedElectricityPerHour: null });
  assert.equal(buildMiningCommandCenterCard(record).decision, 'INSUFFICIENT DATA');
});

test('does not expose a hardware control operation', () => {
  const card = buildMiningCommandCenterCard(evaluateMiningOpportunity(base));
  assert.equal('start' in card, false);
  assert.equal('stop' in card, false);
  assert.equal('control' in card, false);
});
