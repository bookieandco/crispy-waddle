import {createHash} from 'node:crypto';
import type {StockBar} from './stock-market-reality.js';
import type {MoneyFeedAdmission} from './money-finish-feed-admission.js';

export const MONEY_SIGNAL_LEAGUE_SCHEMA='MONEY-FINISH-08' as const;
export type ResearchCandle=Readonly<{
  instrumentId:string;sourceId:string;interval:string;
  openedAt:string;closedAt:string;availableAt:string;receivedAt:string;
  open:number;high:number;low:number;close:number;volume?:number;
  evidenceRef:string;provenanceHash:string;
}>;
export type MoneyTechnicalFeatures=Readonly<{
  sma20:number;sma50:number;ema12:number;ema26:number;macd:number;macdSignal:number;
  rsi14:number;atr14:number;bbUpper:number;bbLower:number;
  vwap20:number|null;previous20High:number;previous20Low:number;
}>;
export type MoneyCandidateSignal=Readonly<{
  strategyId:'TREND_CROSS'|'BOLLINGER_REVERSION'|'PREVIOUS_20_BREAK';
  direction:'LONG_BIAS'|'SHORT_BIAS'|'NO_TRADE';
  explanation:string;
  sourceEvidenceIds:readonly string[];
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneySignalLeague=Readonly<{
  schemaVersion:typeof MONEY_SIGNAL_LEAGUE_SCHEMA;
  asset:'STOCK'|'FOREX';instrumentId:string;sourceId:string;
  informationCutoff:string;
  features:MoneyTechnicalFeatures;
  signals:readonly MoneyCandidateSignal[];
  evidenceHash:string;authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function time(x:string,code:string){const n=Date.parse(x);if(!x||!Number.isFinite(n))throw new Error(code);return n;}
function avg(x:readonly number[]){return x.reduce((sum,v)=>sum+v,0)/x.length;}
function ema(xs:readonly number[],period:number){
  const k=2/(period+1);let e=avg(xs.slice(0,period));
  const values=[...Array.from({length:period-1},()=>NaN),e];
  for(let i=period;i<xs.length;i++){e=xs[i]!*k+e*(1-k);values.push(e);}
  return values;
}
export function stockBarsToResearchCandles(bars:readonly StockBar[],admission:MoneyFeedAdmission):readonly ResearchCandle[]{
  if(admission.asset!=='STOCK'||admission.disposition!=='RESEARCH_ONLY'||admission.canExecute!==false)
    throw new Error('MONEY_SIGNAL_STOCK_ADMISSION_REQUIRED');
  return Object.freeze(bars.map(bar=>{
    if(bar.provider!==admission.sourceId||bar.instrumentId!==admission.instrumentId||
       !admission.admittedObservationIds.includes(bar.barId)||!admission.evidenceIds.includes(bar.evidenceRef))
       throw new Error('MONEY_SIGNAL_STOCK_EVIDENCE_MISMATCH');
    return Object.freeze({instrumentId:bar.instrumentId,sourceId:bar.provider,interval:bar.interval,
      openedAt:bar.startsAt,closedAt:bar.endsAt,availableAt:bar.availableAt,receivedAt:bar.receivedAt,
      open:Number(bar.open),high:Number(bar.high),low:Number(bar.low),close:Number(bar.close),
      volume:Number(bar.volume),evidenceRef:bar.evidenceRef,provenanceHash:bar.provenanceHash});
  }));
}
export function evaluateMoneySignalLeague(input:Readonly<{
  asset:'STOCK'|'FOREX';instrumentId:string;sourceId:string;
  candles:readonly ResearchCandle[];
  informationCutoff:string;sourceReviewEvidenceId:string;
  sessionEvidenceId?:string;
  observedSpreadBps?:number;
  maxSpreadBps?:number;
  maxAgeMs:number;
}>):MoneySignalLeague {
  const cutoff=time(input.informationCutoff,'MONEY_SIGNAL_CUTOFF_INVALID');
  if(!input.instrumentId.trim()||!input.sourceId.trim()||!input.sourceReviewEvidenceId.trim()||
     input.candles.length<60)throw new Error('MONEY_SIGNAL_SOURCE_OR_WARMUP_MISSING');
  if(!Number.isSafeInteger(input.maxAgeMs)||input.maxAgeMs<=0)
    throw new Error('MONEY_SIGNAL_AGE_POLICY_INVALID');
  if(input.asset==='FOREX'&&(!input.sessionEvidenceId?.trim()||
      !Number.isFinite(input.observedSpreadBps)||!Number.isFinite(input.maxSpreadBps)||
      input.observedSpreadBps!<0||input.observedSpreadBps!>input.maxSpreadBps!||
      input.maxSpreadBps!<=0))throw new Error('MONEY_SIGNAL_FX_SPREAD_OR_SESSION_UNVERIFIED');
  let previousEnd=-Infinity;const ids=new Set<string>();
  for(const bar of input.candles){
    if(bar.instrumentId!==input.instrumentId||bar.sourceId!==input.sourceId||
       !bar.interval.trim()||!bar.evidenceRef.trim()||!bar.provenanceHash.trim()||
       ids.has(bar.evidenceRef))throw new Error('MONEY_SIGNAL_CANDLE_PROVENANCE_INVALID');
    ids.add(bar.evidenceRef);
    const opened=time(bar.openedAt,'MONEY_SIGNAL_OPENED_INVALID'),closed=time(bar.closedAt,'MONEY_SIGNAL_CLOSED_INVALID');
    const available=time(bar.availableAt,'MONEY_SIGNAL_AVAILABLE_INVALID'),received=time(bar.receivedAt,'MONEY_SIGNAL_RECEIVED_INVALID');
    if(opened<previousEnd||closed<=opened||closed>available||available>received||received>cutoff)
      throw new Error('MONEY_SIGNAL_UNCLOSED_DUPLICATE_OR_FUTURE_CANDLE');
    previousEnd=closed;
    if([bar.open,bar.high,bar.low,bar.close].some(x=>!Number.isFinite(x)||x<=0)||
       bar.high<Math.max(bar.open,bar.close,bar.low)||bar.low>Math.min(bar.open,bar.close,bar.high)||
       (bar.volume!==undefined&&(!Number.isFinite(bar.volume)||bar.volume<0)))
      throw new Error('MONEY_SIGNAL_CANDLE_PRICES_INVALID');
  }
  if(cutoff-previousEnd>input.maxAgeMs)throw new Error('MONEY_SIGNAL_LAST_BAR_STALE');
  const bars=input.candles,closes=bars.map(b=>b.close),n=bars.length,last=bars[n-1]!;
  const sma20=avg(closes.slice(-20)),sma50=avg(closes.slice(-50));
  const e12=ema(closes,12),e26=ema(closes,26);
  const macds=e26.map((v,i)=>Number.isFinite(v)?e12[i]!-v:NaN);
  const valid=macds.filter(Number.isFinite);
  if(valid.length<9)throw new Error('MONEY_SIGNAL_MACD_WARMUP_REQUIRED');
  const macd=macds[n-1]!,macdSignal=ema(valid,9).at(-1)!;
  let gains=0,losses=0;
  for(let i=n-14;i<n;i++){const delta=closes[i]!-closes[i-1]!;gains+=Math.max(delta,0);losses+=Math.max(-delta,0);}
  const rsi14=losses===0?(gains===0?50:100):100-100/(1+gains/losses);
  const tr:number[]=[];
  for(let i=n-14;i<n;i++){
    const b=bars[i]!,prior=closes[i-1]!;
    tr.push(Math.max(b.high-b.low,Math.abs(b.high-prior),Math.abs(b.low-prior)));
  }
  const atr14=avg(tr);
  const variance=avg(closes.slice(-20).map(x=>(x-sma20)**2));
  const deviation=Math.sqrt(variance),bbUpper=sma20+2*deviation,bbLower=sma20-2*deviation;
  const volumeWindow=bars.slice(-20),vol=volumeWindow.reduce((s,b)=>s+(b.volume??0),0);
  const vwap20=input.asset==='STOCK'&&volumeWindow.every(b=>b.volume!==undefined)&&vol>0
    ?volumeWindow.reduce((s,b)=>s+(b.high+b.low+b.close)/3*b.volume!,0)/vol:null;
  const prior20=bars.slice(-21,-1),previous20High=Math.max(...prior20.map(x=>x.high)),previous20Low=Math.min(...prior20.map(x=>x.low));
  const features=Object.freeze({sma20,sma50,ema12:e12[n-1]!,ema26:e26[n-1]!,
    macd,macdSignal,rsi14,atr14,bbUpper,bbLower,vwap20,previous20High,previous20Low});
  const trend=last.close>sma50&&sma20>sma50&&macd>macdSignal?'LONG_BIAS':
    last.close<sma50&&sma20<sma50&&macd<macdSignal?'SHORT_BIAS':'NO_TRADE';
  const reversion=last.close<bbLower&&rsi14<35?'LONG_BIAS':
    last.close>bbUpper&&rsi14>65?'SHORT_BIAS':'NO_TRADE';
  // The current candle is deliberately excluded from breakout extrema.
  const breakout=last.close>previous20High?'LONG_BIAS':last.close<previous20Low?'SHORT_BIAS':'NO_TRADE';
  const evidence=Object.freeze(bars.map(b=>b.evidenceRef));
  const cand=(strategyId:MoneyCandidateSignal['strategyId'],direction:MoneyCandidateSignal['direction'],explanation:string)=>
    Object.freeze({strategyId,direction,explanation,sourceEvidenceIds:evidence,
      authority:'RESEARCH_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const});
  return Object.freeze({schemaVersion:MONEY_SIGNAL_LEAGUE_SCHEMA,asset:input.asset,
    instrumentId:input.instrumentId,sourceId:input.sourceId,informationCutoff:input.informationCutoff,
    features,signals:Object.freeze([
      cand('TREND_CROSS',trend,'SMA20/SMA50, price context, MACD confirmation'),
      cand('BOLLINGER_REVERSION',reversion,'Bollinger 2 sigma and 14-period RSI threshold'),
      cand('PREVIOUS_20_BREAK',breakout,'Closed bar versus 20 previously closed highs/lows')
    ]),evidenceHash:sha({asset:input.asset,source:input.sourceId,cutoff,
      review:input.sourceReviewEvidenceId,calendar:input.sessionEvidenceId??null,
      spread:input.observedSpreadBps??null,evidence:bars.map(b=>b.provenanceHash),features}),
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
}
