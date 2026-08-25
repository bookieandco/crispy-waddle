import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMiningEconomics } from './mining-economics';
import { createMiningOpportunity } from './mining-opportunity';
import { gateCapitalDecision } from './risk-allocation-gate';

test('mining opportunity cannot bypass exposure gate', () => {
  const economics = calculateMiningEconomics({
    hashratePerSecond: 500e9,
    networkHashratePerSecond: 500e18,
    blockReward: 3.125,
    blocksPerDay: 144,
    coinPrice: 100000,
    powerWatts: 15,
    electricityPricePerKwh: 0.01,
    uptimePct: 1,
    poolFeePct: 0.01,
    hardwareCost: 300,
    maintenancePerDay: 0,
  });
  const opportunity = createMiningOpportunity({
    id: 'mine-1', instrument: 'BTC-mining', economics, confidence: 0.9,
    observedAt: '2026-08-24T12:00:00Z',
  });

  const decision = gateCapitalDecision(opportunity, [{
    domain: 'crypto', instrument: 'BTC', marketValue: 9000, riskWeight: 1,
  }], {
    portfolioValue: 10000, maxInstrumentPct: 0.95, maxDomainPct: { crypto: 0.9 }, maxRiskWeightedPct: 0.9,
  }, {
    availableCash: 10000, survivalFloor: 1000, taxReserve: 1000, operatingReserve: 1000,
    maxPortfolioRisk: 0.2, maxDomainAllocation: { crypto: 5000 },
  });

  assert.equal(decision.risk.allowed, false);
  assert.equal(decision.allocation.recommendedAmount, 0);
  assert.equal(decision.eligibleForConsiderAlert, false);
});
