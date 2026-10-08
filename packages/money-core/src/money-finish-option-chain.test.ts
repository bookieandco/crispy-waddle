import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMoneyOptionsChain,toLongOptionPayoffResearch,type OptionChainRow} from './money-finish-option-chain.js';
import {buildOptionRiskProfile} from './options-contracts.js';
import {MARKET_DATA_SOURCE_SCHEMA_VERSION,type MarketDataSourceContract} from './market-data-source-contracts.js';
import type {MoneySourceReview} from './money-finish-source-admission.js';

const cutoff='2026-10-08T18:00:00Z';
const source:MarketDataSourceContract={
 schemaVersion:MARKET_DATA_SOURCE_SCHEMA_VERSION,sourceId:'option-feed-licensed',providerName:'Verified fixture',
 sourceKind:'LICENSED_API',canonicalLocator:'https://example.org/options',transports:['HTTP'],
 capabilities:['OPTIONS_CHAIN','OPTIONS_GREEKS'],assetClasses:['OPTIONS'],
 pointInTimeSupport:'NATIVE_AVAILABLE_AT',supportsObservedAt:true,supportsAvailableAt:true,
 rights:{basis:'UPSTREAM_TERMS_REVIEW',termsLocator:'https://example.org/terms',
 evaluatedAt:'2026-10-08T00:00:00Z',research:'ALLOWED',modelTraining:'UNKNOWN',
 commercialInternal:'UNKNOWN',redistribution:'RESTRICTED',resale:'RESTRICTED',evidenceRefs:['licensed:fixture']},
 provenanceHash:'options-source-hash',financialAuthority:'NONE'
};
const review:MoneySourceReview={reviewId:'rights-reviewed',codeClearance:'VERIFIED',
 reviewEvidenceIds:['independent:review'],allowedCapabilities:['OPTIONS_CHAIN']};
const row:OptionChainRow={
 occSymbol:'AAPL  261016C00150000',underlyingInstrumentId:'stock:AAPL',currency:'USD',
 contractMultiplier:100,adjusted:false,adjustmentEvidenceRefs:[],exerciseStyle:'AMERICAN',
 settlementType:'PHYSICAL',expirationAt:'2026-10-16T20:00:00Z',
 lastTradingAt:'2026-10-16T20:00:00Z',exerciseCutoffAt:'2026-10-16T20:00:00Z',
 settlementEvidenceId:'occ:exercise:terms',bid:'1.20',ask:'1.30',bidSize:10,askSize:12,
 openInterest:1000,openInterestAsOf:'2026-10-07T22:00:00Z',volume:75,impliedVolatility:0.35,
 greeks:{delta:0.51,gamma:0.03,theta:-0.02,vega:0.12},
 observedAt:'2026-10-08T17:59:50Z',availableAt:'2026-10-08T17:59:52Z',
 receivedAt:'2026-10-08T17:59:55Z',provider:source.sourceId,
 evidenceRef:'options:obs:1',provenanceHash:'option-hash'
};
const input={source,review,rows:[row],informationCutoff:cutoff,maxQuoteAgeMs:60000,
 maxPaperSpreadBps:1000,minTimeToLastTradingMs:30*60*1000};
test('FINISH.07 licensed OCC chain becomes paper quote candidate, not execution authority',()=>{
 const out=normalizeMoneyOptionsChain(input);
 assert.equal(out.disposition,'RESEARCH_ONLY');
 assert.equal(out.canAuthorizeLive,false);
 const option=out.options[0]!;
 assert.equal(option.strikePrice,150);
 assert.equal(option.right,'CALL');
 assert.equal(option.readiness,'PAPER_QUOTE_CANDIDATE');
 const contract=toLongOptionPayoffResearch(option,1);
 assert.equal(contract.premiumPerUnit,1.3);
 assert.equal(buildOptionRiskProfile(contract).maxLoss.amount,130);
});
test('FINISH.07 rejects mismatched expiry, duplicate, adjusted-without-proof, stale and crossed quote',()=>{
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,underlyingInstrumentId:'stock:TSLA'}]}),/UNDERLYING_ROOT_MISMATCH/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,occSymbol:'AAPL  261016C00000000'}]}),/OCC_STRIKE_INVALID/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[row,row]}),/DUPLICATE_CONTRACT/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,expirationAt:'2026-10-17T20:00:00Z'}]}),/SETTLEMENT_CHRONOLOGY/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,contractMultiplier:50}]}),/ADJUSTMENT_UNVERIFIED/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,bid:'1.5'}]}),/CROSSED/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,availableAt:'2026-10-09T00:00:00Z'}]}),/TIME_LEAK/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,openInterestAsOf:'2026-10-09T00:00:00Z'}]}),/OI_NOT_POINT_IN_TIME/);
});
test('FINISH.07 illiquid/0DTE/adjusted choices remain research and cannot form paper contracts',()=>{
 const illiquid=normalizeMoneyOptionsChain({...input,rows:[{...row,bidSize:0}]}).options[0]!;
 assert.equal(illiquid.readiness,'RESEARCH_ONLY');
 assert.throws(()=>toLongOptionPayoffResearch(illiquid,1),/PAPER_CANDIDATE_REQUIRED/);
 const dayOf='2026-10-08T20:00:00Z';
 const dte=normalizeMoneyOptionsChain({...input,rows:[{...row,
   occSymbol:'AAPL  261008C00150000',expirationAt:dayOf,lastTradingAt:dayOf,exerciseCutoffAt:dayOf}]}).options[0]!;
 assert.ok(dte.reasonCodes.includes('ZERO_DTE_ASSIGNMENT_AND_PIN_RISK'));
 const adj=normalizeMoneyOptionsChain({...input,rows:[{...row,
   contractMultiplier:50,adjusted:true,adjustmentEvidenceRefs:['occ:adjusted:terms']}]}).options[0]!;
 assert.ok(adj.reasonCodes.includes('ADJUSTED_CONTRACT_REVIEW'));
});
test('FINISH.07 rejects unknown source rights and false live-chain claim',()=>{
 assert.throws(()=>normalizeMoneyOptionsChain({...input,source:{...source,rights:{...source.rights,research:'UNKNOWN'}}}),/USE_NOT_ALLOWED/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,provider:'made-up'}]}),/PROVENANCE_INVALID/);
 assert.throws(()=>normalizeMoneyOptionsChain({...input,rows:[{...row,greeks:{delta:2,gamma:0,theta:0,vega:0}}]}),/GREEKS_INVALID/);
});
