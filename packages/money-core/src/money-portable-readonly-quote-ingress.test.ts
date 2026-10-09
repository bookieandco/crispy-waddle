import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {admitPortableReadOnlyQuote,MoneyPortableQuoteJournal,
 fromAlpacaStockQuote,fromFxTwoSidedQuote,fromMetalTwoSidedQuote,
 fromOptionTwoSidedQuote,runMoneyReadOnlyQuoteCycle,
 type MoneyPortableRightsReceipt} from './money-portable-readonly-quote-ingress.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction} from './money-finish-forward-grades.js';
import {MoneyForwardResearchQueue} from './money-forward-durable-research-cycles.js';
import {MoneyLocalForwardJournal} from './money-finish-forward-journal.js';
import type {FxQuote} from './fx-market-reality.js';
import type {StockQuote} from './stock-market-reality.js';
import type {MetalQuote} from './metals-market-reality.js';
import type {OptionChainRow} from './money-finish-option-chain.js';

const origin='2026-10-01T00:00:00Z',decision='2026-10-01T00:01:00Z';
const at=(n:number)=>new Date(Date.parse(decision)+n).toISOString();
const rights:MoneyPortableRightsReceipt={
 asset:'STOCK',sourceId:'alpaca-market-data:iex',vendorId:'alpaca',
 entitlementEvidenceId:'external:rights',sourceObservationReceiptId:'external:request',
 independentReviewEvidenceId:'external:separate-review',sourceResponseSha256:'a'.repeat(64),
 observationMode:'LIVE_READ_ONLY',authorizedResearchUse:true,authorizedRetention:true,
 allowsForwardPaperStudy:true,expiresAt:'2026-11-01T00:00:00Z',
 canExecute:false,canAuthorizeLive:false
};
const stock:StockQuote={
 quoteId:'stock-q:1',instrumentId:'stock:TEST',venue:'IEX',currency:'USD',
 bidPrice:'100',askPrice:'100.2',observedAt:'2026-10-01T00:00:52Z',
 availableAt:'2026-10-01T00:00:53Z',receivedAt:'2026-10-01T00:00:54Z',
 provider:rights.sourceId,evidenceRef:'alpaca:observation:1',provenanceHash:'hash:stock:1'
};
const prepare=(q=stock,asOf='2026-10-01T00:00:56Z',r=rights)=>
 admitPortableReadOnlyQuote({
   asset:'STOCK',source:fromAlpacaStockQuote(q),rights:r,asOf,
   maxQuoteAgeMs:60_000,maxSpreadBps:300
 });
test('PORTABLE.4 source adapter maps real shape into explicitly nonexecuting quote',()=>{
 const e=prepare();
 assert.equal(e.quote.bid,100);
 assert.equal(e.quote.ask,100.2);
 assert.equal(e.canAuthorizeLive,false);
 assert.equal(e.rights.observationMode,'LIVE_READ_ONLY');
});
test('PORTABLE.4 denies unlicensed, synthetic, unknown and expired feed',()=>{
 for(const patch of [{observationMode:'SYNTHETIC' as const},
                     {authorizedRetention:false as const},
                     {canExecute:true as const},
                     {entitlementEvidenceId:''}]){
   assert.throws(()=>prepare(stock,'2026-10-01T00:00:56Z',
     {...rights,...patch} as MoneyPortableRightsReceipt),/LICENSED_SOURCE_NOT_VERIFIED/);
 }
 assert.throws(()=>prepare(stock,'2026-11-02T00:00:00Z'),/LICENSE_EXPIRED/);
});
test('PORTABLE.4 rejects lookahead, zero-sided, crossed spread and stale marks',()=>{
 assert.throws(()=>prepare({...stock,receivedAt:'2026-10-01T00:02:00Z'}),
   /FUTURE_OR_UNAVAILABLE/);
 assert.throws(()=>prepare({...stock,bidPrice:'0'}),/PRICE_INVALID/);
 assert.throws(()=>prepare({...stock,bidPrice:'200'}),/QUOTE_INVALID/);
 assert.throws(()=>prepare(stock,'2026-10-01T00:10:56Z'),
   /FEED_STALE_OR_MARKET_CLOSED/);
});
test('PORTABLE.4 FX, metals, and options require real quote and contract context',()=>{
 const fx:FxQuote={quoteId:'fx:q1',pairId:'fx:EURUSD',baseCurrency:'EUR',quoteCurrency:'USD',
    bidPrice:'1.07',askPrice:'1.071',observedAt:stock.observedAt,
    availableAt:stock.availableAt,receivedAt:stock.receivedAt,
    provider:'fx:vendor',sourceType:'DIRECT',sourceQuoteIds:['q'],evidenceRefs:['fx:evidence'],
    provenanceHash:'fx:hash'};
 assert.throws(()=>fromFxTwoSidedQuote({...fx,sourceType:'CROSS_DERIVED'}),
   /FX_SYNTHETIC_CROSS_DENIED/);
 assert.throws(()=>admitPortableReadOnlyQuote({
    asset:'FOREX',source:fromFxTwoSidedQuote(fx),
    rights:{...rights,asset:'FOREX',sourceId:'fx:vendor'},
    asOf:'2026-10-01T00:00:56Z',maxQuoteAgeMs:60_000,maxSpreadBps:300
 }),/FX_SESSION_UNVERIFIED/);
 const metal:MetalQuote={quoteId:'metal:q1',instrumentId:'metal:XAUUSD',
   venue:'vendor',metal:'XAU',unit:'TROY_OUNCE',currency:'USD',
   bidPrice:'1900',askPrice:'1901',observedAt:stock.observedAt,
   availableAt:stock.availableAt,receivedAt:stock.receivedAt,
   provider:'metals:vendor',evidenceRefs:['metal:proof'],provenanceHash:'metal:hash'};
 assert.equal(fromMetalTwoSidedQuote(metal).bid,'1900');
 assert.throws(()=>admitPortableReadOnlyQuote({
    asset:'METALS',source:fromMetalTwoSidedQuote(metal),
    rights:{...rights,asset:'METALS',sourceId:'metals:vendor'},
    asOf:'2026-10-01T00:00:56Z',maxQuoteAgeMs:60_000,maxSpreadBps:300
 }),/METALS_UNIT_UNVERIFIED/);
 const option={evidenceRef:'option:proof',occSymbol:'TEST261016C00100000',
   provider:'option:vendor',bid:'1.2',ask:'1.4',
   observedAt:stock.observedAt,availableAt:stock.availableAt,
   receivedAt:stock.receivedAt,provenanceHash:'option:hash',
   adjustmentEvidenceRefs:[],settlementEvidenceId:'settlement:proof'} as unknown as OptionChainRow;
 assert.throws(()=>fromOptionTwoSidedQuote(option),/OPTION_CONTRACT_PROOF_REQUIRED/);
});
test('PORTABLE.5 fsync/restart hash journal, replay and tampering are detected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'money-quote-'));
 try{
  const file=join(dir,'quotes.jsonl'),a=new MoneyPortableQuoteJournal(file);
  const e=prepare();
  assert.equal((await a.append(e)).disposition,'INSERTED');
  assert.equal((await (new MoneyPortableQuoteJournal(file)).append(e)).disposition,'REPLAY');
  assert.equal((await (new MoneyPortableQuoteJournal(file)).list()).length,1);
  const modified={...e,quote:{...e.quote,bid:99}};
  await assert.rejects(()=>a.append(modified),/INGRESS_TAMPERED/);
  const original=await readFile(file,'utf8');
  await writeFile(file,original.replace('"100.2"','"111.2"').replace('"ask":100.2','"ask":111.2'));
  await assert.rejects(()=>a.list(),/INGRESS_TAMPERED|EVENT_TAMPERED/);
  await writeFile(file,original.trimEnd());
  await assert.rejects(()=>a.list(),/INGRESS_TORN_LINE/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('PORTABLE.5 full one-shot grade from stored entry/exit without provider network writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'money-quote-run-'));
 try{
  const quoteJournal=new MoneyPortableQuoteJournal(join(dir,'market.jsonl'));
  const predictionQueue=new MoneyForwardResearchQueue(join(dir,'predictions.jsonl'));
  const gradeJournal=new MoneyLocalForwardJournal(join(dir,'grades.jsonl'));
  await quoteJournal.append(prepare());
  const candidate=registerMoneyStrategy({
    candidateId:'quote:research:1',strategyFamily:'TREND',asset:'STOCK',
    instrumentId:'stock:TEST',methodologyVersion:'v1',sourceSchema:'MONEY-FINISH-08',
    sourceEvidenceIds:['research:rights'],informationCutoff:'2026-09-30T00:00:00Z',
    createdAt:'2026-09-30T01:00:00Z',parameters:{lookback:20},
    maximumDevelopmentTrials:3
  });
  const prediction=makeMoneyForwardPrediction({
    candidate,predictionId:'prediction:one',direction:'LONG_BIAS',
    decisionAt:decision,createdAt:at(1000),
    informationCutoff:'2026-10-01T00:00:55Z',entry:prepare().quote,
    informationEvidenceIds:['study:evidence'],
    sourceRightsEvidenceId:'external:rights',maximumEntrySpreadBps:300
  });
  await predictionQueue.register(prediction);
  const due=at(900000),exit:StockQuote={
     ...stock,quoteId:'stock-q:exit',bidPrice:'101',askPrice:'101.2',
     observedAt:due,availableAt:at(900001),receivedAt:at(900002),
     evidenceRef:'alpaca:exit',provenanceHash:'raw:exit'
  };
  await quoteJournal.append(prepare(exit,at(900003)));
  const args={quoteJournal,predictionQueue,gradeJournal,
     asOf:at(900005),maxMarkDelayMs:30000,maxSpreadBps:300,
     additionalRoundTripCostBps:3};
  const first=await runMoneyReadOnlyQuoteCycle(args);
  assert.equal(first.cycle.insertedGrades,1);
  assert.equal(first.cycle.unmaturedHorizons.length,5);
  const second=await runMoneyReadOnlyQuoteCycle(args);
  assert.equal(second.cycle.insertedGrades,0);
  assert.equal((await gradeJournal.verifyReadback()).count,1);
  assert.equal(first.canExecute,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
