import test from 'node:test';
import assert from 'node:assert/strict';
import {
  futureFoundationSemantics,
  optionFoundationSemantics,
} from './trading-vehicle-semantics.js';

test('MONEY-VEHICLE-SEMANTICS-01 preserves option beginner concepts without collapsing right into direction', () => {
  const option = optionFoundationSemantics();

  assert.equal(option.longCallCanExpressBullishView, true);
  assert.equal(option.longPutCanExpressBearishView, true);
  assert.equal(option.optionRightAloneDeterminesStrategyDirection, false);
  assert.equal(option.buyerHasRightNotObligation, true);
  assert.equal(option.sellerMayHaveAssignmentObligation, true);
  assert.equal(option.longOptionCanExpireWorthless, true);
  assert.equal(option.marketHoursAreVenueAndProductSpecific, true);
  assert.equal(option.strategyEdgeTransfersWithoutValidation, false);
  assert.equal(option.financialAuthority, 'NONE');
});

test('MONEY-VEHICLE-SEMANTICS-01 requires explicit futures contract and roll handling', () => {
  const future = futureFoundationSemantics();

  assert.equal(future.contractsExpire, true);
  assert.equal(future.contractIsStandardized, true);
  assert.equal(future.automaticRollover, false);
  assert.equal(future.continuousChartMaySpanMultipleContracts, true);
  assert.equal(future.contractSelectionAndRollPolicyRequired, true);
  assert.equal(future.marketHoursAreVenueAndProductSpecific, true);
  assert.equal(future.strategyEdgeTransfersWithoutValidation, false);
  assert.equal(future.financialAuthority, 'NONE');
});
