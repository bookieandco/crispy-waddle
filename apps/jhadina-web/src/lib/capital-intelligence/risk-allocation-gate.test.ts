import assert from 'node:assert/strict';
import test from 'node:test';
import { gateCapitalDecision } from './risk-allocation-gate';
import type { OpportunityScore } from './opportunity-engine';

const opportunity: OpportunityScore = {
  id: 'op-1', domain: 'equities', instrument: 'AAPL', expectedReturn: 0.1,
  probability: 0.8, downside: 0.04, liquidityScore: 0.9, confidence: 0.9,
  observedAt: '2026-08-24T12:00:00Z', expectedValue: 0.072, riskAdjustedScore: 0.0648,
  action: 'consider', reasons: ['positive risk-adjusted expected value'],
};

const constraints = {
  availableCash: 10000, survivalFloor: 1000, taxReserve: 1000, operatingReserve: 1000,
  maxPortfolioRisk: 0.2, maxDomainAllocation: { equities: 5000 },
};

test('passes risk before producing a consider allocation', () => {
  const result = gateCapitalDecision(opportunity, [], {
    portfolioValue: 10000, maxInstrumentPct: 0.5, maxDomainPct: { equities: 0.8 }, maxRiskWeightedPct: 0.9,
  }, constraints);
  assert.equal(result.risk.allowed, true);
  assert.equal(result.allocation.action, 'consider');
  assert.equal(result.eligibleForConsiderAlert, true);
});

test('blocks consider when instrument concentration is at the limit', () => {
  const result = gateCapitalDecision(opportunity, [{ domain: 'equities', instrument: 'AAPL', marketValue: 5000 }], {
    portfolioValue: 10000, maxInstrumentPct: 0.5, maxDomainPct: { equities: 0.8 }, maxRiskWeightedPct: 0.9,
  }, constraints);
  assert.equal(result.risk.allowed, false);
  assert.equal(result.allocation.recommendedAmount, 0);
  assert.equal(result.allocation.riskAllowed, false);
  assert.equal(result.eligibleForConsiderAlert, false);
});

test('blocks consider when domain concentration is at the domain limit', () => {
  const result = gateCapitalDecision(opportunity, [{ domain: 'equities', instrument: 'MSFT', marketValue: 8000 }], {
    portfolioValue: 10000, maxInstrumentPct: 0.9, maxDomainPct: { equities: 0.8 }, maxRiskWeightedPct: 0.9,
  }, constraints);
  assert.equal(result.risk.allowed, false);
  assert.equal(result.eligibleForConsiderAlert, false);
});

test('blocks consider when risk-weighted portfolio exposure is at the limit', () => {
  const result = gateCapitalDecision(opportunity, [
    { domain: 'forex', instrument: 'EUR/USD', marketValue: 9000, riskWeight: 1 },
  ], {
    portfolioValue: 10000, maxInstrumentPct: 0.9, maxDomainPct: { equities: 0.9 }, maxRiskWeightedPct: 0.9,
  }, constraints);
  assert.equal(result.risk.allowed, false);
  assert.equal(result.eligibleForConsiderAlert, false);
});

test('blocks consider when allocation is zero even if risk passes', () => {
  const result = gateCapitalDecision(opportunity, [], {
    portfolioValue: 10000, maxInstrumentPct: 0.5, maxDomainPct: { equities: 0.8 }, maxRiskWeightedPct: 0.9,
  }, { ...constraints, availableCash: 3000, survivalFloor: 1500, taxReserve: 1000, operatingReserve: 500 });
  assert.equal(result.risk.allowed, true);
  assert.equal(result.allocation.recommendedAmount, 0);
  assert.equal(result.eligibleForConsiderAlert, false);
});
