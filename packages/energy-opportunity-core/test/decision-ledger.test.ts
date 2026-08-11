import { describe, expect, it } from 'vitest';
import { InMemoryMiningDecisionLedger } from '../src/decision-ledger';
import { evaluateMiningOpportunity } from '../src/economic-decision';

describe('MiningDecisionLedger', () => {
  it('stores an advisory decision once and ignores duplicate decision ids', async () => {
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

    expect(ledger.list()).toEqual([record]);
  });
});
