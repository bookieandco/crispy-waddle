import test from 'node:test';
import assert from 'node:assert/strict';
import {rankMoneyStockPastOnly,evaluateFiveMinuteOpeningRange} from './money-finish-stock-rank-orb.js';
import type {ResearchCandle} from './money-finish-signal-league.js';
const day=86400000,dt=(ms:number)=>new Date(ms).toISOString();
const daily=Array.from({length:105},(_,i):ResearchCandle=>{
 const start=Date.UTC(2026,0,1)+i*day,close=100+0.3*i;
 return {instrumentId:'stock:TEST',sourceId:'test',interval:'1D',
   openedAt:dt(start),closedAt:dt(start+day),availableAt:dt(start+day),receivedAt:dt(start+day),
   open:close,high:close+1,low:close-1,close,volume:100,evidenceRef:'bar:'+i,provenanceHash:'hash:'+i};
});
const rankInput={candles:daily,instrumentId:'stock:TEST',sourceId:'test',
 informationCutoff:daily.at(-1)!.closedAt,sourceReviewEvidenceId:'terms:verified'};
test('FINISH.08 past-only R-stock-inspired 15/30/90 rank is deterministic, not a probability',()=>{
 const a=rankMoneyStockPastOnly(rankInput),b=rankMoneyStockPastOnly(rankInput);
 assert.equal(a.evidenceHash,b.evidenceHash);assert.equal(a.windows.length,3);
 assert.deepEqual(a.windows.map(w=>w.period),[15,30,90]);
 assert.ok(a.compositeScore>=0&&a.compositeScore<=100);
 assert.equal(a.methodology,'R_STOCK_INSPIRED_NONPREDICTIVE');
 assert.equal(a.canAuthorizeLive,false);
});
test('FINISH.08 rank rejects future data, insufficient warmup and duplicate evidence',()=>{
 assert.throws(()=>rankMoneyStockPastOnly({...rankInput,candles:daily.slice(0,90)}),/REQUIRES_91/);
 assert.throws(()=>rankMoneyStockPastOnly({...rankInput,candles:[
   ...daily.slice(0,-1),{...daily.at(-1)!,availableAt:'2027-01-01T00:00:00Z',receivedAt:'2027-01-01T00:00:00Z'}]}),/INCOMPLETE_OR_FUTURE_CANDLE/);
 assert.throws(()=>rankMoneyStockPastOnly({...rankInput,candles:[
   ...daily.slice(0,-1),{...daily.at(-1)!,evidenceRef:daily[0]!.evidenceRef}]}),/SOURCE_MISMATCH/);
});
const t0=Date.UTC(2026,9,8,13,30);
const values=[
 {open:100,high:101,low:99,close:100.1},
 {open:100.1,high:101.5,low:99.5,close:101},
 {open:101,high:101.2,low:99.8,close:100.5},
 {open:100.5,high:103,low:100.5,close:102.4},
 {open:102.4,high:103,low:101.4,close:102.5}
];
const five=values.map((v,i):ResearchCandle=>({
 instrumentId:'stock:TEST',sourceId:'test',interval:'5m',openedAt:dt(t0+i*300000),
 closedAt:dt(t0+(i+1)*300000),availableAt:dt(t0+(i+1)*300000),
 receivedAt:dt(t0+(i+1)*300000),...v,volume:100,evidenceRef:'five:'+i,provenanceHash:'fivehash:'+i
}));
const intraday={candles:five,instrumentId:'stock:TEST',sourceId:'test',
 informationCutoff:five.at(-1)!.closedAt,sessionOpenAt:dt(t0),
 sourceReviewEvidenceId:'provider:rights',sessionCalendarEvidenceId:'exchange:session'};
test('FINISH.08 ORB requires a 15-minute opening range plus later closed breakout AND retest',()=>{
 const r=evaluateFiveMinuteOpeningRange(intraday);
 assert.equal(r.direction,'LONG_BIAS');assert.equal(r.rangeHigh,101.5);
 assert.equal(r.breakoutAt,five[3]!.closedAt);
 assert.equal(r.retestAt,five[4]!.closedAt);
 assert.equal(r.canExecute,false);
});
test('FINISH.08 ORB refuses missing session data, gaps, unclosed retest and no retest',()=>{
 assert.throws(()=>evaluateFiveMinuteOpeningRange({...intraday,sessionCalendarEvidenceId:''}),/SESSION_OR_BARS_MISSING/);
 assert.throws(()=>evaluateFiveMinuteOpeningRange({...intraday,
   informationCutoff:dt(t0+6*300000),candles:[
   ...five.slice(0,-1),{...five.at(-1)!,openedAt:dt(t0+5*300000),
     closedAt:dt(t0+6*300000),availableAt:dt(t0+6*300000),
     receivedAt:dt(t0+6*300000)}]}),/FIVE_MINUTE_SESSION_GAP/);
 assert.throws(()=>evaluateFiveMinuteOpeningRange({...intraday,candles:[
   ...five.slice(0,-1),{...five.at(-1)!,receivedAt:'2026-10-09T00:00:00Z'}]}),/INCOMPLETE_OR_FUTURE_CANDLE/);
 const noRetest=evaluateFiveMinuteOpeningRange({...intraday,candles:[
   ...five.slice(0,-1),{...five.at(-1)!,low:102.2}]});
 assert.equal(noRetest.direction,'NO_TRADE');
});
