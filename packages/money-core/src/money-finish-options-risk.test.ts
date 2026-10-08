import test from 'node:test';
import assert from 'node:assert/strict';
import {blackScholesResearch,evaluateMoneyOptionsRisk} from './money-finish-options-risk.js';
import type {MoneyOptionsChain,AdmittedOptionChainRow} from './money-finish-option-chain.js';

function close(actual:number,want:number,tolerance=0.005){
  assert.ok(Math.abs(actual-want)<tolerance,'expected '+actual+' close to '+want);
}
test('FINISH.09 Black-Scholes European proxy matches independent textbook price and Greeks',()=>{
  const x={spot:100,strike:100,yearFraction:1,volatility:0.2,riskFreeRate:0.05,
    dividendYield:0,exerciseStyle:'EUROPEAN' as const};
  const call=blackScholesResearch({...x,right:'CALL'});
  const put=blackScholesResearch({...x,right:'PUT'});
  close(call.theoreticalPremium,10.4506);
  close(put.theoreticalPremium,5.5735);
  close(call.delta,0.63683);
  close(call.gamma,0.01876,0.0001);
  close(call.vega,37.524,0.01);
  close(call.theoreticalPremium-put.theoreticalPremium,100-100*Math.exp(-0.05));
  assert.equal(call.modelApplicability,'EUROPEAN');
  assert.ok(call.charmPerCalendarDay!==null);
  assert.throws(()=>blackScholesResearch({...x,right:'CALL',volatility:0}),/MODEL_DOMAIN_INVALID/);
});
const option:AdmittedOptionChainRow={
  optionId:'AAPL  261016C00150000',underlyingInstrumentId:'stock:AAPL',
  right:'CALL',strikePrice:150,expirationAt:'2026-10-16T20:00:00Z',
  contractMultiplier:100,bid:'1.2',ask:'1.3',bidSize:10,askSize:10,midpoint:'1.25',
  impliedVolatility:0.32,settlementType:'PHYSICAL',exerciseStyle:'AMERICAN',
  sourceEvidenceIds:['options:receipt'],readiness:'PAPER_QUOTE_CANDIDATE',
  reasonCodes:[],canExecute:false,canAuthorizeLive:false
};
const chain:MoneyOptionsChain={schemaVersion:'MONEY-FINISH-07',sourceId:'options-feed',
  informationCutoff:'2026-10-08T18:00:00Z',options:[option],
  disposition:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
  evidenceHash:'chain:hash'};
const scenario={optionId:option.optionId,openInterest:500,openInterestAsOf:'2026-10-08T17:00:00Z'};
const input={chain,underlyingInstrumentId:'stock:AAPL',underlyingPrice:150,
  riskFreeRate:0.04,dividendYield:0.0,scenarioPositions:[scenario],
  underlyingEvidenceId:'underlying:receipt',rateEvidenceId:'rates:receipt'};
test('FINISH.09 dealer sign is unknown without independent position evidence',()=>{
  const out=evaluateMoneyOptionsRisk(input);
  assert.equal(out.signedAggregateGexUsdPerOnePctMove,null);
  assert.equal(out.disposition,'CONDITIONAL_SCENARIOS_ONLY');
  assert.equal(out.canAuthorizeLive,false);
  assert.equal(out.rows[0]?.dealerPositionSource,'UNKNOWN');
  assert.ok(out.boundedGexUsdPerOnePctMove.minimum<0);
  assert.ok(out.boundedGexUsdPerOnePctMove.maximum>0);
  assert.ok(out.rows[0]?.reasonCodes.includes('EUROPEAN_PROXY_FOR_AMERICAN_OPTION'));
});
test('FINISH.09 conditional signed GEX requires an explicit position-side evidence receipt',()=>{
  assert.throws(()=>evaluateMoneyOptionsRisk({...input,scenarioPositions:[{...scenario,estimatedDealerContracts:100}]}),/DEALER_ESTIMATE_UNVERIFIED/);
  const signed=evaluateMoneyOptionsRisk({...input,scenarioPositions:[{...scenario,estimatedDealerContracts:-100,dealerEvidenceId:'positions:licensed-20261008'}]});
  assert.ok(signed.signedAggregateGexUsdPerOnePctMove!<0);
  assert.equal(signed.rows[0]?.dealerPositionSource,'EVIDENCE_BACKED_ESTIMATE');
  assert.equal(signed.canExecute,false);
});
test('FINISH.09 rejects lookahead OI, wrong underlying, unsupported IV and expired source',()=>{
  assert.throws(()=>evaluateMoneyOptionsRisk({...input,scenarioPositions:[{...scenario,openInterestAsOf:'2026-10-09T00:00:00Z'}]}),/OI_UNAVAILABLE/);
  assert.throws(()=>evaluateMoneyOptionsRisk({...input,underlyingInstrumentId:'stock:TSLA'}),/UNDERLYING_MISMATCH/);
  assert.throws(()=>evaluateMoneyOptionsRisk({...input,chain:{...chain,options:[{...option,impliedVolatility:undefined}]}}),/IV_REQUIRED/);
  assert.throws(()=>evaluateMoneyOptionsRisk({...input,chain:{...chain,informationCutoff:'2026-11-01T00:00:00Z'}}),/EXPIRED_CONTRACT/);
});
