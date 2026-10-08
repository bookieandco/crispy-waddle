import {createHash} from 'node:crypto';
import type {ResearchCandle} from './money-finish-signal-league.js';

export const MONEY_STOCK_RANK_ORB_SCHEMA='MONEY-FINISH-08-EXT' as const;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function time(v:string,code:string){const t=Date.parse(v);if(!v||!Number.isFinite(t))throw new Error(code);return t;}
function mean(xs:readonly number[]){return xs.reduce((s,x)=>s+x,0)/xs.length;}
function checkSeries(input:Readonly<{
  candles:readonly ResearchCandle[];instrumentId:string;sourceId:string;cutoff:string;
  evidenceRef:string;
}>) {
  const end=time(input.cutoff,'MONEY_ORB_CUTOFF_INVALID');
  if(!input.evidenceRef.trim()||!input.instrumentId.trim()||!input.sourceId.trim()||!input.candles.length)
    throw new Error('MONEY_ORB_SOURCE_EVIDENCE_REQUIRED');
  const ids=new Set<string>();let prior=-Infinity;
  for(const c of input.candles){
    const open=time(c.openedAt,'MONEY_ORB_OPEN_INVALID'),close=time(c.closedAt,'MONEY_ORB_CLOSE_INVALID');
    const available=time(c.availableAt,'MONEY_ORB_AVAILABLE_INVALID'),received=time(c.receivedAt,'MONEY_ORB_RECEIVED_INVALID');
    if(c.instrumentId!==input.instrumentId||c.sourceId!==input.sourceId||!c.evidenceRef.trim()||
       !c.provenanceHash.trim()||ids.has(c.evidenceRef))
      throw new Error('MONEY_ORB_SOURCE_MISMATCH');
    ids.add(c.evidenceRef);
    if(open<prior||open>=close||close>available||available>received||received>end)
      throw new Error('MONEY_ORB_INCOMPLETE_OR_FUTURE_CANDLE');
    prior=close;
    if([c.open,c.high,c.low,c.close].some(x=>!Number.isFinite(x)||x<=0)||
       c.high<Math.max(c.open,c.low,c.close)||c.low>Math.min(c.open,c.high,c.close))
      throw new Error('MONEY_ORB_BAD_CANDLE');
  }
}
function rsi(xs:readonly number[],window:number):number {
  let up=0,down=0;
  for(let i=xs.length-window;i<xs.length;i++){const delta=xs[i]!-xs[i-1]!;up+=Math.max(delta,0);down+=Math.max(-delta,0);}
  return down===0?(up===0?50:100):100-100/(1+up/down);
}
function linearSlope(xs:readonly number[]):number {
  const center=(xs.length-1)/2,m=mean(xs);
  let num=0,den=0;
  for(let i=0;i<xs.length;i++){const dx=i-center;num+=dx*(xs[i]!-m);den+=dx*dx;}
  return num/den/m;
}
export type MoneyStockRanking=Readonly<{
  schemaVersion:typeof MONEY_STOCK_RANK_ORB_SCHEMA;
  instrumentId:string;informationCutoff:string;
  windows:readonly Readonly<{period:15|30|90;percentB:number;rsi:number;normalizedSlopePerBar:number}>[];
  compositeScore:number;
  methodology:'R_STOCK_INSPIRED_NONPREDICTIVE';
  evidenceHash:string;
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export function rankMoneyStockPastOnly(input:Readonly<{
  candles:readonly ResearchCandle[];instrumentId:string;sourceId:string;
  informationCutoff:string;sourceReviewEvidenceId:string;
}>):MoneyStockRanking {
  if(input.candles.length<91)throw new Error('MONEY_STOCK_RANK_REQUIRES_91_CLOSED_BARS');
  checkSeries({...input,cutoff:input.informationCutoff,evidenceRef:input.sourceReviewEvidenceId});
  if(input.candles.some(c=>c.interval!=='1D'||c.volume===undefined))
    throw new Error('MONEY_STOCK_RANK_DAILY_STOCK_BARS_REQUIRED');
  const prices=input.candles.map(c=>c.close);
  const windows=([15,30,90] as const).map(period=>{
    const sample=prices.slice(-period),m=mean(sample);
    const sd=Math.sqrt(mean(sample.map(x=>(x-m)**2)));
    return Object.freeze({period,percentB:sd>0?(prices.at(-1)!-(m-2*sd))/(4*sd):0.5,
      rsi:rsi(prices,period),normalizedSlopePerBar:linearSlope(sample)});
  });
  // Explicit bounded heuristic. A score is a rank signal, not a win probability.
  const compositeScore=windows.reduce((s,w)=>s+
    0.45*Math.min(1,Math.max(0,w.percentB))+
    0.35*w.rsi/100+
    0.20*Math.min(1,Math.max(0,0.5+w.normalizedSlopePerBar*50)),0)/3*100;
  return Object.freeze({schemaVersion:MONEY_STOCK_RANK_ORB_SCHEMA,instrumentId:input.instrumentId,
    informationCutoff:input.informationCutoff,windows:Object.freeze(windows),compositeScore,
    methodology:'R_STOCK_INSPIRED_NONPREDICTIVE',authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:sha({cutoff:input.informationCutoff,review:input.sourceReviewEvidenceId,
      bars:input.candles.map(c=>c.provenanceHash),windows})});
}
export type MoneyOpeningRangeCandidate=Readonly<{
  schemaVersion:typeof MONEY_STOCK_RANK_ORB_SCHEMA;
  instrumentId:string;sessionOpenAt:string;informationCutoff:string;
  rangeHigh:number;rangeLow:number;
  breakoutAt:string|null;retestAt:string|null;
  direction:'LONG_BIAS'|'SHORT_BIAS'|'NO_TRADE';
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;evidenceHash:string;
}>;
export function evaluateFiveMinuteOpeningRange(input:Readonly<{
  candles:readonly ResearchCandle[];instrumentId:string;sourceId:string;
  informationCutoff:string;sourceReviewEvidenceId:string;
  sessionOpenAt:string;sessionCalendarEvidenceId:string;
}>):MoneyOpeningRangeCandidate {
  if(!input.sessionCalendarEvidenceId.trim()||input.candles.length<5)
    throw new Error('MONEY_ORB_SESSION_OR_BARS_MISSING');
  checkSeries({...input,cutoff:input.informationCutoff,evidenceRef:input.sourceReviewEvidenceId});
  const open=time(input.sessionOpenAt,'MONEY_ORB_SESSION_OPEN_INVALID');
  for(let i=0;i<input.candles.length;i++){
    const bar=input.candles[i]!;
    if(bar.interval!=='5m'||time(bar.openedAt,'MONEY_ORB_OPEN_INVALID')!==open+i*300000||
       time(bar.closedAt,'MONEY_ORB_CLOSE_INVALID')!==open+(i+1)*300000)
      throw new Error('MONEY_ORB_FIVE_MINUTE_SESSION_GAP');
  }
  const opening=input.candles.slice(0,3);
  const rangeHigh=Math.max(...opening.map(x=>x.high)),rangeLow=Math.min(...opening.map(x=>x.low));
  let direction:'LONG_BIAS'|'SHORT_BIAS'|'NO_TRADE'='NO_TRADE';
  let breakoutAt:string|null=null,retestAt:string|null=null;
  for(let i=3;i<input.candles.length-1;i++){
    const breakout=input.candles[i]!,retest=input.candles[i+1]!;
    if(breakout.close>rangeHigh && retest.low<=rangeHigh && retest.close>rangeHigh){
      direction='LONG_BIAS';breakoutAt=breakout.closedAt;retestAt=retest.closedAt;break;
    }
    if(breakout.close<rangeLow && retest.high>=rangeLow && retest.close<rangeLow){
      direction='SHORT_BIAS';breakoutAt=breakout.closedAt;retestAt=retest.closedAt;break;
    }
  }
  return Object.freeze({schemaVersion:MONEY_STOCK_RANK_ORB_SCHEMA,
    instrumentId:input.instrumentId,sessionOpenAt:input.sessionOpenAt,informationCutoff:input.informationCutoff,
    rangeHigh,rangeLow,direction,breakoutAt,retestAt,
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:sha({cutoff:input.informationCutoff,review:input.sourceReviewEvidenceId,
      calendar:input.sessionCalendarEvidenceId,bars:input.candles.map(c=>c.provenanceHash),direction,breakoutAt,retestAt})});
}
