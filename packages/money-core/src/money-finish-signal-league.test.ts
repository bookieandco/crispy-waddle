import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMoneySignalLeague,stockBarsToResearchCandles,type ResearchCandle} from './money-finish-signal-league.js';
import type {StockBar} from './stock-market-reality.js';
import type {MoneyFeedAdmission} from './money-finish-feed-admission.js';

const day=86400000;
const candles=(count=65):ResearchCandle[]=>Array.from({length:count},(_,i)=>{
  const openedAt=new Date(Date.UTC(2026,0,1)+i*day).toISOString();
  const closedAt=new Date(Date.UTC(2026,0,1)+(i+1)*day).toISOString();
  const close=100+i*0.5+(i===count-1?4:0);
  return {instrumentId:'stock:TEST',sourceId:'reviewed-provider',interval:'1D',
    openedAt,closedAt,availableAt:closedAt,receivedAt:closedAt,
    open:close,high:close+1,low:close-1,close,volume:100,
    evidenceRef:'bar:'+i,provenanceHash:'hash:'+i};
});
const make=(bars:readonly ResearchCandle[])=>({asset:'STOCK' as const,instrumentId:'stock:TEST',
  sourceId:'reviewed-provider',candles:bars,informationCutoff:bars.at(-1)!.closedAt,
  sourceReviewEvidenceId:'rights:receipt',maxAgeMs:1000});
test('FINISH.08 indicators are deterministic, closed-bar only and never executable',()=>{
  const cs=candles(),a=evaluateMoneySignalLeague(make(cs)),b=evaluateMoneySignalLeague(make(cs));
  assert.equal(a.evidenceHash,b.evidenceHash);
  assert.equal(a.features.sma20,cs.slice(-20).reduce((s,x)=>s+x.close,0)/20);
  assert.equal(a.features.rsi14,100);
  assert.ok(a.features.atr14>0);
  assert.ok(Number.isFinite(a.features.macdSignal));
  assert.ok(a.features.vwap20!==null);
  assert.equal(a.signals.length,3);
  assert.equal(a.signals[0]?.direction,'LONG_BIAS');
  assert.equal(a.signals[2]?.direction,'LONG_BIAS');
  assert.equal(a.canAuthorizeLive,false);
  assert.equal(a.signals.every(s=>s.canExecute===false),true);
});
test('FINISH.08 future, unfinished, unverified, stale or repeated candle is refused',()=>{
  const cs=candles(),end=cs.length-1,last=cs[end]!;
  assert.throws(()=>evaluateMoneySignalLeague(make(cs.slice(0,59))),/WARMUP_MISSING/);
  assert.throws(()=>evaluateMoneySignalLeague(make([...cs.slice(0,-1),{...last,availableAt:new Date(Date.parse(last.closedAt)+day).toISOString()}])),/FUTURE_CANDLE/);
  assert.throws(()=>evaluateMoneySignalLeague(make([...cs.slice(0,-1),{...last,closedAt:last.openedAt}])),/UNCLOSED_DUPLICATE_OR_FUTURE_CANDLE/);
  assert.throws(()=>evaluateMoneySignalLeague(make([...cs.slice(0,-1),{...last,evidenceRef:cs[0]!.evidenceRef}])),/PROVENANCE_INVALID/);
  assert.throws(()=>evaluateMoneySignalLeague({...make(cs),informationCutoff:new Date(Date.parse(last.closedAt)+day).toISOString()}),/LAST_BAR_STALE/);
  assert.throws(()=>evaluateMoneySignalLeague(make([...cs.slice(0,-1),{...last,high:1}])),/CANDLE_PRICES_INVALID/);
});
test('FINISH.08 actual stock admission IDs must match all input bars',()=>{
  const cs=candles();
  const bars:StockBar[]=cs.map(c=>({barId:c.evidenceRef,instrumentId:c.instrumentId,
    venue:'IEX',currency:'USD',interval:c.interval,startsAt:c.openedAt,endsAt:c.closedAt,
    observedAt:c.closedAt,availableAt:c.availableAt,receivedAt:c.receivedAt,
    open:String(c.open),high:String(c.high),low:String(c.low),close:String(c.close),
    volume:String(c.volume),adjustmentStatus:'UNADJUSTED',provider:c.sourceId,
    evidenceRef:c.evidenceRef,provenanceHash:c.provenanceHash}));
  const admission:MoneyFeedAdmission={schemaVersion:'MONEY-FINISH-05',asset:'STOCK',instrumentId:'stock:TEST',
    sourceId:'reviewed-provider',informationCutoff:cs.at(-1)!.closedAt,
    admittedObservationIds:bars.map(b=>b.barId),evidenceIds:bars.map(b=>b.evidenceRef),
    disposition:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false};
  const normalized=stockBarsToResearchCandles(bars,admission);
  assert.equal(evaluateMoneySignalLeague(make(normalized)).signals.length,3);
  assert.throws(()=>stockBarsToResearchCandles(bars,{...admission,evidenceIds:[]}),/EVIDENCE_MISMATCH/);
});
test('FINISH.08 FX candle features require proof of session and spread, never infer tradeable FX volume',()=>{
  const fxCandles=candles().map(c=>({...c,instrumentId:'fx:EURUSD',volume:undefined}));
  const base={...make(fxCandles),asset:'FOREX' as const,instrumentId:'fx:EURUSD'};
  assert.throws(()=>evaluateMoneySignalLeague(base),/FX_SPREAD_OR_SESSION_UNVERIFIED/);
  const r=evaluateMoneySignalLeague({...base,sessionEvidenceId:'session:official',
    observedSpreadBps:2,maxSpreadBps:5});
  assert.equal(r.features.vwap20,null);
  assert.equal(r.canExecute,false);
  assert.throws(()=>evaluateMoneySignalLeague({...base,sessionEvidenceId:'session:official',
    observedSpreadBps:7,maxSpreadBps:5}),/FX_SPREAD_OR_SESSION_UNVERIFIED/);
});
