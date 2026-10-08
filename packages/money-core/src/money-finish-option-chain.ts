import {createHash} from 'node:crypto';
import {assertOptionContract, OPTIONS_SCHEMA_VERSION, type OptionContract,
  type OptionExerciseStyle, type OptionSettlementType, type OptionRight} from './options-contracts.js';
import {admitMoneyResearchObservation,type MoneySourceReview} from './money-finish-source-admission.js';
import type {MarketDataSourceContract} from './market-data-source-contracts.js';
import type {MarketObservationRecord} from './market-provenance-contracts.js';

export const MONEY_OPTION_CHAIN_SCHEMA='MONEY-FINISH-07' as const;
export type OptionChainRow=Readonly<{
  occSymbol:string;
  underlyingInstrumentId:string;
  currency:'USD';
  contractMultiplier:number;
  adjusted:boolean;
  adjustmentEvidenceRefs:readonly string[];
  exerciseStyle:OptionExerciseStyle;
  settlementType:OptionSettlementType;
  expirationAt:string;
  lastTradingAt:string;
  exerciseCutoffAt:string;
  settlementEvidenceId:string;
  bid:string;ask:string;
  bidSize:number;askSize:number;
  openInterest?:number;openInterestAsOf?:string;
  volume?:number;
  impliedVolatility?:number;
  greeks?:Readonly<{delta:number;gamma:number;theta:number;vega:number;rho?:number}>;
  observedAt:string;
  availableAt:string;
  receivedAt:string;
  provider:string;
  evidenceRef:string;
  provenanceHash:string;
}>;
export type AdmittedOptionChainRow=Readonly<{
  optionId:string;
  underlyingInstrumentId:string;
  right:OptionRight;
  strikePrice:number;
  expirationAt:string;
  contractMultiplier:number;
  bid:string;
  ask:string;
  bidSize:number;
  askSize:number;
  midpoint:string;
  impliedVolatility?:number;
  greeks?:OptionChainRow['greeks'];
  settlementType:OptionSettlementType;
  exerciseStyle:OptionExerciseStyle;
  sourceEvidenceIds:readonly string[];
  readiness:'RESEARCH_ONLY'|'PAPER_QUOTE_CANDIDATE';
  reasonCodes:readonly string[];
  canExecute:false;
  canAuthorizeLive:false;
}>;
export type MoneyOptionsChain=Readonly<{
  schemaVersion:typeof MONEY_OPTION_CHAIN_SCHEMA;
  sourceId:string;
  informationCutoff:string;
  options:readonly AdmittedOptionChainRow[];
  disposition:'RESEARCH_ONLY';
  canExecute:false;
  canAuthorizeLive:false;
  evidenceHash:string;
}>;
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function t(s:string,code:string){const n=Date.parse(s);if(!s||!Number.isFinite(n))throw new Error(code);return n;}
function decimal(v:string,code:string){if(!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(v))throw new Error(code);const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(code);return n;}
function integer(v:number,code:string){if(!Number.isSafeInteger(v)||v<0)throw new Error(code);}
function parseOcc(symbol:string){
  const match=/^([A-Z0-9 ]{6})([0-9]{6})([CP])([0-9]{8})$/.exec(symbol);
  if(!match||!match[1]!.trim())throw new Error('MONEY_OPTION_OCC_SYMBOL_INVALID');
  const d=match[2]!;
  const y=2000+Number(d.slice(0,2)),m=Number(d.slice(2,4)),day=Number(d.slice(4,6));
  const iso=[y,String(m).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
  const dt=new Date(iso+'T00:00:00Z');
  if(Number.isNaN(dt.valueOf())||dt.toISOString().slice(0,10)!==iso)throw new Error('MONEY_OPTION_OCC_EXPIRY_DATE_INVALID');
  return {root:match[1]!.trim(),date:iso,right:match[3]==='C'?'CALL' as const:'PUT' as const,
    strike:Number(match[4])/1000};
}
export function normalizeMoneyOptionsChain(input:Readonly<{
  source:MarketDataSourceContract;
  review:MoneySourceReview;
  rows:readonly OptionChainRow[];
  informationCutoff:string;
  maxQuoteAgeMs:number;
  maxPaperSpreadBps:number;
  minTimeToLastTradingMs:number;
}>):MoneyOptionsChain {
  const cutoff=t(input.informationCutoff,'MONEY_OPTION_CHAIN_CUTOFF_INVALID');
  if(!input.rows.length)throw new Error('MONEY_OPTION_CHAIN_EMPTY');
  for(const n of [input.maxQuoteAgeMs,input.minTimeToLastTradingMs]) {
    if(!Number.isSafeInteger(n)||n<0)throw new Error('MONEY_OPTION_CHAIN_TIME_POLICY_INVALID');
  }
  if(!Number.isFinite(input.maxPaperSpreadBps)||input.maxPaperSpreadBps<=0||input.maxPaperSpreadBps>10000)
    throw new Error('MONEY_OPTION_CHAIN_SPREAD_POLICY_INVALID');
  const keys=new Set<string>();
  const options=input.rows.map(row=>{
    const occ=parseOcc(row.occSymbol);
    if(occ.strike<=0)throw new Error('MONEY_OPTION_OCC_STRIKE_INVALID');
    if(!row.adjusted && !['stock:'+occ.root,'index:'+occ.root].includes(row.underlyingInstrumentId))
      throw new Error('MONEY_OPTION_UNDERLYING_ROOT_MISMATCH');
    if(keys.has(row.occSymbol))throw new Error('MONEY_OPTION_CHAIN_DUPLICATE_CONTRACT');
    keys.add(row.occSymbol);
    if(row.currency!=='USD'||!row.underlyingInstrumentId.trim()||!row.evidenceRef.trim()||
       !row.provenanceHash.trim()||row.provider!==input.source.sourceId||!row.settlementEvidenceId.trim())
      throw new Error('MONEY_OPTION_CHAIN_PROVENANCE_INVALID');
    if(!['AMERICAN','EUROPEAN','OTHER'].includes(row.exerciseStyle)||
       !['PHYSICAL','CASH','OTHER'].includes(row.settlementType))throw new Error('MONEY_OPTION_CHAIN_SETTLEMENT_INVALID');
    if(!Number.isSafeInteger(row.contractMultiplier)||row.contractMultiplier<=0)
      throw new Error('MONEY_OPTION_CHAIN_MULTIPLIER_INVALID');
    if((row.adjusted||row.contractMultiplier!==100)&&!row.adjustmentEvidenceRefs.length)
      throw new Error('MONEY_OPTION_CHAIN_ADJUSTMENT_UNVERIFIED');
    if(row.contractMultiplier!==100&&!row.adjusted)throw new Error('MONEY_OPTION_CHAIN_ADJUSTMENT_UNVERIFIED');
    const expiry=t(row.expirationAt,'MONEY_OPTION_CHAIN_EXPIRY_INVALID');
    const last=t(row.lastTradingAt,'MONEY_OPTION_CHAIN_LAST_TRADE_INVALID');
    const exercise=t(row.exerciseCutoffAt,'MONEY_OPTION_CHAIN_EXERCISE_CUTOFF_INVALID');
    if(row.expirationAt.slice(0,10)!==occ.date||last>expiry||exercise>expiry)
      throw new Error('MONEY_OPTION_CHAIN_SETTLEMENT_CHRONOLOGY_INVALID');
    const observed=t(row.observedAt,'MONEY_OPTION_CHAIN_OBSERVED_INVALID');
    const available=t(row.availableAt,'MONEY_OPTION_CHAIN_AVAILABLE_INVALID');
    const received=t(row.receivedAt,'MONEY_OPTION_CHAIN_RECEIVED_INVALID');
    if(observed>available||available>received||received>cutoff)
      throw new Error('MONEY_OPTION_CHAIN_TIME_LEAK');
    const bid=decimal(row.bid,'MONEY_OPTION_CHAIN_BID_INVALID'),ask=decimal(row.ask,'MONEY_OPTION_CHAIN_ASK_INVALID');
    if(ask<bid)throw new Error('MONEY_OPTION_CHAIN_CROSSED');
    integer(row.bidSize,'MONEY_OPTION_CHAIN_BID_SIZE_INVALID');
    integer(row.askSize,'MONEY_OPTION_CHAIN_ASK_SIZE_INVALID');
    if(row.volume!==undefined)integer(row.volume,'MONEY_OPTION_CHAIN_VOLUME_INVALID');
    if(row.openInterest!==undefined){
      integer(row.openInterest,'MONEY_OPTION_CHAIN_OI_INVALID');
      if(!row.openInterestAsOf||t(row.openInterestAsOf,'MONEY_OPTION_CHAIN_OI_TIMESTAMP_INVALID')>cutoff)
        throw new Error('MONEY_OPTION_CHAIN_OI_NOT_POINT_IN_TIME');
    }
    if(row.impliedVolatility!==undefined &&
      (!Number.isFinite(row.impliedVolatility)||row.impliedVolatility<0||row.impliedVolatility>10))
      throw new Error('MONEY_OPTION_CHAIN_IV_INVALID');
    if(row.greeks) {
      const {delta,gamma,theta,vega,rho}=row.greeks;
      if([delta,gamma,theta,vega,...(rho===undefined?[]:[rho])].some(v=>!Number.isFinite(v))||
          delta< -1 ||delta>1 ||gamma<0||vega<0)
        throw new Error('MONEY_OPTION_CHAIN_GREEKS_INVALID');
    }
    const observation:MarketObservationRecord={
      observationId:'options:'+digest({symbol:row.occSymbol,observed:row.observedAt,provenance:row.provenanceHash}),
      instrumentId:row.occSymbol,provider:row.provider,observationType:'OPTION_CHAIN_QUOTE',
      value:row.ask,observedAt:row.observedAt,availableAt:row.availableAt,
      receivedAt:row.receivedAt,effectiveAt:row.observedAt,qualityStatus:'VALID',
      evidenceRef:row.evidenceRef,provenanceHash:row.provenanceHash,
    };
    admitMoneyResearchObservation({source:input.source,review:input.review,observation,
      cutoff:input.informationCutoff,purpose:'RESEARCH',requiredCapability:'OPTIONS_CHAIN'});
    const reasons:string[]=[];
    const mid=(bid+ask)/2;
    const spreadBps=mid>0?(ask-bid)/mid*10000:Infinity;
    if(received-observed>input.maxQuoteAgeMs||cutoff-observed>input.maxQuoteAgeMs)reasons.push('QUOTE_STALE');
    if(bid<=0||ask<=0||row.bidSize<=0||row.askSize<=0||spreadBps>input.maxPaperSpreadBps)
      reasons.push('ILLQUID_OR_WIDE_SPREAD');
    if(last<=cutoff||last-cutoff<=input.minTimeToLastTradingMs)reasons.push('EXPIRATION_OR_LAST_TRADE_CUTOFF');
    if(row.settlementType==='OTHER'||row.exerciseStyle==='OTHER')reasons.push('SETTLEMENT_UNSUPPORTED');
    if(row.adjusted)reasons.push('ADJUSTED_CONTRACT_REVIEW');
    if(row.settlementType==='PHYSICAL'&&new Date(expiry).toISOString().slice(0,10)===new Date(cutoff).toISOString().slice(0,10))
      reasons.push('ZERO_DTE_ASSIGNMENT_AND_PIN_RISK');
    return Object.freeze({
      optionId:row.occSymbol,underlyingInstrumentId:row.underlyingInstrumentId,
      right:occ.right,strikePrice:occ.strike,expirationAt:row.expirationAt,
      contractMultiplier:row.contractMultiplier,bid:row.bid,ask:row.ask,
      bidSize:row.bidSize,askSize:row.askSize,midpoint:String(mid),
      impliedVolatility:row.impliedVolatility,greeks:row.greeks,
      settlementType:row.settlementType,exerciseStyle:row.exerciseStyle,
      sourceEvidenceIds:Object.freeze([row.evidenceRef,row.settlementEvidenceId,...row.adjustmentEvidenceRefs].sort()),
      readiness:reasons.length?'RESEARCH_ONLY' as const:'PAPER_QUOTE_CANDIDATE' as const,
      reasonCodes:Object.freeze(reasons),canExecute:false as const,canAuthorizeLive:false as const
    });
  });
  return Object.freeze({schemaVersion:MONEY_OPTION_CHAIN_SCHEMA,sourceId:input.source.sourceId,
    informationCutoff:input.informationCutoff,options:Object.freeze(options),
    disposition:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:digest({provider:input.source.provenanceHash,cutoff,options:options.map(x=>[x.optionId,x.sourceEvidenceIds,x.readiness])})});
}
// Analysis-only bridge to the existing payoff model. A chain quote is never an order.
export function toLongOptionPayoffResearch(row:AdmittedOptionChainRow,quantity:number):OptionContract {
  if(row.readiness!=='PAPER_QUOTE_CANDIDATE'||!Number.isSafeInteger(quantity)||quantity<=0)
    throw new Error('MONEY_OPTION_PAPER_CANDIDATE_REQUIRED');
  const contract:OptionContract={
    schemaVersion:OPTIONS_SCHEMA_VERSION,optionId:row.optionId,
    underlyingInstrumentId:row.underlyingInstrumentId,right:row.right,positionSide:'LONG',
    strikePrice:row.strikePrice,premiumPerUnit:Number(row.ask),quantity,
    contractMultiplier:row.contractMultiplier,expirationAt:row.expirationAt,
    quoteCurrency:'USD',exerciseStyle:row.exerciseStyle,settlementType:row.settlementType,
    evidenceRefs:row.sourceEvidenceIds,methodologyVersion:MONEY_OPTION_CHAIN_SCHEMA,
    provenanceHash:digest({optionId:row.optionId,ask:row.ask,evidence:row.sourceEvidenceIds}),
    financialAuthority:'NONE'
  };
  assertOptionContract(contract);
  return Object.freeze(contract);
}
