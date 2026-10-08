import test from 'node:test';
import assert from 'node:assert/strict';
import {admitStockMarketEvidence,admitFxMarketQuote} from './money-finish-feed-admission.js';
import {MARKET_DATA_SOURCE_SCHEMA_VERSION,type MarketDataSourceContract} from './market-data-source-contracts.js';
import type {MoneySourceReview} from './money-finish-source-admission.js';
import type {StockBar,StockQuote,StockCorporateAction} from './stock-market-reality.js';
import type {FxQuote} from './fx-market-reality.js';

const cutoff='2026-10-08T18:00:00Z';
const source:MarketDataSourceContract={
  schemaVersion:MARKET_DATA_SOURCE_SCHEMA_VERSION,sourceId:'test-provider',providerName:'fixture',
  sourceKind:'LICENSED_API',canonicalLocator:'https://example.org/data',transports:['HTTP'],
  capabilities:['CANDLES','LIVE_TICKS','FOREX'],assetClasses:['STOCK','FOREX'],
  pointInTimeSupport:'NATIVE_AVAILABLE_AT',supportsObservedAt:true,supportsAvailableAt:true,
  rights:{basis:'UPSTREAM_TERMS_REVIEW',termsLocator:'https://example.org/terms',
    evaluatedAt:'2026-10-08T00:00:00Z',research:'ALLOWED',modelTraining:'RESTRICTED',
    commercialInternal:'UNKNOWN',redistribution:'RESTRICTED',resale:'RESTRICTED',evidenceRefs:['terms:verified']},
  provenanceHash:'source-hash',financialAuthority:'NONE'
};
const review:MoneySourceReview={reviewId:'review-1',codeClearance:'VERIFIED',
  reviewEvidenceIds:['source:independent'],allowedCapabilities:['CANDLES','LIVE_TICKS','FOREX']};
const bar=(startsAt:string,endsAt:string):StockBar=>({
  barId:'bar:'+startsAt,instrumentId:'stock:TEST',venue:'TEST',currency:'USD',interval:'1D',
  startsAt,endsAt,observedAt:endsAt,availableAt:endsAt,receivedAt:cutoff,
  open:'100',high:'110',low:'98',close:'105',volume:'1000',adjustmentStatus:'UNADJUSTED',
  provider:source.sourceId,evidenceRef:'bar:'+endsAt,provenanceHash:'bar:proof'
});
const bars=[bar('2026-10-06T00:00:00Z','2026-10-07T00:00:00Z'),
  bar('2026-10-07T00:00:00Z','2026-10-08T00:00:00Z')];
const quote:StockQuote={quoteId:'q1',instrumentId:'stock:TEST',venue:'TEST',currency:'USD',
  bidPrice:'101',askPrice:'102',observedAt:'2026-10-08T17:59:57Z',
  availableAt:'2026-10-08T17:59:58Z',receivedAt:'2026-10-08T17:59:59Z',
  provider:source.sourceId,evidenceRef:'quote:1',provenanceHash:'quote:h'};
const stock={source,review,bars,quote,corporateActions:[] as readonly StockCorporateAction[],
  corporateActionCoverage:'VERIFIED' as const,corporateActionEvidenceIds:['corporate:verified'],
  informationCutoff:cutoff,quoteMaxAgeMs:10000,instrumentId:'stock:TEST'};
const fxQuote:FxQuote={quoteId:'fx1',pairId:'fx:EURUSD',baseCurrency:'EUR',quoteCurrency:'USD',
  bidPrice:'1.08002',askPrice:'1.08006',observedAt:'2026-10-08T17:59:57Z',
  availableAt:'2026-10-08T17:59:58Z',receivedAt:'2026-10-08T17:59:59Z',
  provider:source.sourceId,sourceType:'DIRECT',sourceQuoteIds:[],evidenceRefs:['fx:proof'],provenanceHash:'fx:h'};
const fx={source,review,quote:fxQuote,instrumentId:'fx:EURUSD',informationCutoff:cutoff,
  maxAgeMs:5000,sessionStatus:'OPEN' as const,calendarEvidenceId:'calendar:actual'};
test('FINISH.05 admitted stock bars and a fresh quote cannot execute',()=>{
  const got=admitStockMarketEvidence(stock);
  assert.equal(got.disposition,'RESEARCH_ONLY');assert.equal(got.canExecute,false);
  assert.equal(got.admittedObservationIds.length,3);
});
test('FINISH.05 stock intake rejects unknown corporate-action coverage, split and duplicate/future bars',()=>{
  assert.throws(()=>admitStockMarketEvidence({...stock,corporateActionCoverage:'UNKNOWN'}),/COVERAGE_UNKNOWN/);
  const split:StockCorporateAction={actionId:'s1',instrumentId:'stock:TEST',actionType:'SPLIT',status:'EFFECTIVE',
    announcedAt:'2026-10-06T01:00:00Z',availableAt:'2026-10-06T01:00:00Z',receivedAt:cutoff,
    effectiveAt:'2026-10-07T00:00:00Z',provider:source.sourceId,evidenceRef:'split',provenanceHash:'split:h'};
  assert.throws(()=>admitStockMarketEvidence({...stock,corporateActions:[split]}),/UNADJUSTED_CORPORATE_ACTION/);
  assert.throws(()=>admitStockMarketEvidence({...stock,corporateActions:[{...split,effectiveAt:undefined}]}),/EFFECTIVE_DATE_UNVERIFIED/);
  assert.throws(()=>admitStockMarketEvidence({...stock,bars:[bars[0]!,bars[0]!]}),/ORDER_OR_DUPLICATE/);
  assert.throws(()=>admitStockMarketEvidence({...stock,bars:[bars[0]!,{...bars[1]!,availableAt:'2026-10-09T00:00:00Z',receivedAt:'2026-10-09T00:00:00Z'}]}),/CHRONOLOGY/);
  assert.throws(()=>admitStockMarketEvidence({...stock,quote:{...quote,askPrice:'99'}}),/CROSSED_QUOTE/);
});
test('FINISH.05 stock and FX intake refuse stale quote, bad source or questionable calendar',()=>{
  assert.throws(()=>admitStockMarketEvidence({...stock,quoteMaxAgeMs:1}),/STALE/);
  assert.throws(()=>admitStockMarketEvidence({...stock,source:{...source,rights:{...source.rights,research:'UNKNOWN'}}}),/USE_NOT_ALLOWED/);
  assert.throws(()=>admitFxMarketQuote({...fx,sessionStatus:'HOLIDAY'}),/SESSION_OR_CALENDAR/);
  assert.throws(()=>admitFxMarketQuote({...fx,quote:{...fxQuote,provider:'other'}}),/PROVIDER_OR_PAIR/);
  assert.throws(()=>admitFxMarketQuote({...fx,quote:{...fxQuote,bidPrice:'1.2',askPrice:'1.1'}}),/CROSSED_QUOTE/);
  assert.throws(()=>admitFxMarketQuote({...fx,maxAgeMs:1}),/STALE/);
});
test('FINISH.05 fresh two-sided FX quote remains research only',()=>{
  const got=admitFxMarketQuote(fx);
  assert.equal(got.asset,'FOREX');assert.equal(got.canAuthorizeLive,false);
  assert.equal(got.admittedObservationIds.length,1);
});
