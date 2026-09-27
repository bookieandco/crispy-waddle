import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONS_SCHEMA_VERSION,
  assertOptionContract,
  buildOptionRiskProfile,
  deriveOptionPremiumSnapshot,
  expiryPnl,
  optionBreakEvenUnderlyingPrice,
  type OptionContract,
} from './options-contracts.js';

function makeContract(
  overrides: Partial<OptionContract> = {},
): OptionContract {
  return {
    schemaVersion: OPTIONS_SCHEMA_VERSION,
    optionId: 'option:tsla:165:call',
    underlyingInstrumentId: 'stock:TSLA',
    right: 'CALL',
    positionSide: 'LONG',
    strikePrice: 165,
    premiumPerUnit: 10,
    quantity: 1,
    contractMultiplier: 1,
    expirationAt: '2026-12-31T21:00:00Z',
    quoteCurrency: 'USD',
    exerciseStyle: 'AMERICAN',
    settlementType: 'PHYSICAL',
    evidenceRefs: ['source:options-basics'],
    methodologyVersion: 'money-options-01',
    provenanceHash: 'options-proof',
    financialAuthority: 'NONE',
    ...overrides,
  };
}

test('MONEY-OPTIONS-01 models the source call example at expiry', () => {
  const c = makeContract();
  assert.equal(optionBreakEvenUnderlyingPrice(c), 175);
  assert.equal(expiryPnl(c, 190), 15);
  assert.equal(expiryPnl(c, 160), -10);

  const risk = buildOptionRiskProfile(c);
  assert.deepEqual(risk.maxLoss, { kind: 'DEFINED', amount: 10 });
  assert.deepEqual(risk.maxGain, { kind: 'UNBOUNDED' });
  assert.equal(risk.assignmentObligation, false);
  assert.equal(risk.authority, 'ANALYSIS_ONLY');
});

test('MONEY-OPTIONS-01 models long put payoff and defined loss', () => {
  const c = makeContract({
    optionId: 'option:tsla:165:put',
    right: 'PUT',
  });

  assert.equal(optionBreakEvenUnderlyingPrice(c), 155);
  assert.equal(expiryPnl(c, 140), 15);
  assert.equal(expiryPnl(c, 180), -10);

  const risk = buildOptionRiskProfile(c);
  assert.deepEqual(risk.maxLoss, { kind: 'DEFINED', amount: 10 });
  assert.deepEqual(risk.maxGain, { kind: 'DEFINED', amount: 155 });
});

test('MONEY-OPTIONS-01 distinguishes short call unbounded loss from short put bounded loss', () => {
  const shortCall = makeContract({ positionSide: 'SHORT' });
  const shortPut = makeContract({
    optionId: 'option:tsla:165:put:short',
    right: 'PUT',
    positionSide: 'SHORT',
  });

  assert.deepEqual(buildOptionRiskProfile(shortCall).maxLoss, { kind: 'UNBOUNDED' });
  assert.deepEqual(buildOptionRiskProfile(shortPut).maxLoss, {
    kind: 'DEFINED',
    amount: 155,
  });
  assert.equal(buildOptionRiskProfile(shortCall).assignmentObligation, true);
  assert.equal(buildOptionRiskProfile(shortPut).assignmentObligation, true);
});

test('MONEY-OPTIONS-01 decomposes observed premium into intrinsic and extrinsic value without inventing a pricing model', () => {
  const c = makeContract();
  const p = deriveOptionPremiumSnapshot({
    contract: c,
    underlyingPrice: 170,
    observedPremiumPerUnit: 12,
    impliedVolatility: 0.42,
    timeToExpirationYears: 0.25,
    observedAt: '2026-09-26T20:00:00Z',
    evidenceRefs: ['quote:reference'],
    provenanceHash: 'premium-proof',
  });

  assert.equal(p.intrinsicValuePerUnit, 5);
  assert.equal(p.extrinsicValuePerUnit, 7);
  assert.equal(p.financialAuthority, 'NONE');
});

test('MONEY-OPTIONS-01 rejects unproven or malformed contracts', () => {
  assert.throws(
    () => assertOptionContract(makeContract({ evidenceRefs: [] })),
    /MONEY_OPTIONS_EVIDENCE_REQUIRED/,
  );
  assert.throws(
    () => assertOptionContract(makeContract({ strikePrice: 0 })),
    /MONEY_OPTIONS_STRIKE_INVALID/,
  );
  assert.throws(
    () => assertOptionContract(makeContract({ financialAuthority: 'LIVE' as never })),
    /MONEY_OPTIONS_FINANCIAL_AUTHORITY_FORBIDDEN/,
  );
});
