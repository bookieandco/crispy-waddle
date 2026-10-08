import {createHash} from 'node:crypto';
import type {MoneyOptionsChain} from './money-finish-option-chain.js';
import {MONEY_OPTION_CHAIN_SCHEMA} from './money-finish-option-chain.js';

export const MONEY_OPTIONS_RISK_SCHEMA='MONEY-FINISH-09' as const;
export type EuropeanProxyGreeks=Readonly<{
  model:'BLACK_SCHOLES_MERTON_EUROPEAN_PROXY';
  modelApplicability:'EUROPEAN'|'AMERICAN_APPROXIMATION';
  right:'CALL'|'PUT';
  theoreticalPremium:number;delta:number;gamma:number;vega:number;
  thetaPerYear:number;rho:number;vannaPerVolatilityUnit:number;
  charmPerCalendarDay:number|null;
  yearFraction:number;
}>;
export type DealerExposureResearch=Readonly<{
  optionId:string;openInterest:number;openInterestAsOf:string;
  dealerPositionSource:'UNKNOWN'|'EVIDENCE_BACKED_ESTIMATE';
  assumedDealerContracts:number|null;
  gexUsdPerOnePctMove:number|null;
  lowerGexUsdPerOnePctMove:number;
  upperGexUsdPerOnePctMove:number;
  model:EuropeanProxyGreeks;
  reasonCodes:readonly string[];
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type MoneyOptionsRiskResearch=Readonly<{
  schemaVersion:typeof MONEY_OPTIONS_RISK_SCHEMA;sourceId:string;underlyingInstrumentId:string;
  informationCutoff:string;underlyingPrice:number;rows:readonly DealerExposureResearch[];
  signedAggregateGexUsdPerOnePctMove:number|null;
  boundedGexUsdPerOnePctMove:Readonly<{minimum:number;maximum:number}>;
  disposition:'CONDITIONAL_SCENARIOS_ONLY';canExecute:false;canAuthorizeLive:false;
  evidenceHash:string;
}>;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const root=Math.sqrt(2*Math.PI);
const density=(x:number)=>Math.exp(-0.5*x*x)/root;
// Abramowitz-Stegun 7.1.26, maximum CDF approximation error ~7.5e-8.
function cdf(x:number){
  const z=Math.abs(x),t=1/(1+0.2316419*z);
  const p=1-density(z)*(0.319381530*t-0.356563782*t*t+1.781477937*t**3-1.821255978*t**4+1.330274429*t**5);
  return x>=0?p:1-p;
}
function finite(x:number,code:string){if(!Number.isFinite(x))throw new Error(code);}
function time(x:string,code:string){const v=Date.parse(x);if(!x||!Number.isFinite(v))throw new Error(code);return v;}
function deltaAt(right:'CALL'|'PUT',S:number,K:number,T:number,sigma:number,r:number,q:number){
  const d1=(Math.log(S/K)+(r-q+sigma*sigma/2)*T)/(sigma*Math.sqrt(T));
  return Math.exp(-q*T)*(right==='CALL'?cdf(d1):cdf(d1)-1);
}
export function blackScholesResearch(input:Readonly<{
  right:'CALL'|'PUT';exerciseStyle:'AMERICAN'|'EUROPEAN';
  spot:number;strike:number;yearFraction:number;
  volatility:number;riskFreeRate:number;dividendYield:number;
}>):EuropeanProxyGreeks {
  const {right,spot:S,strike:K,yearFraction:T,volatility:sigma,riskFreeRate:r,dividendYield:q}=input;
  for(const v of [S,K,T,sigma,r,q])finite(v,'MONEY_OPTIONS_RISK_INPUT_NONFINITE');
  if(S<=0||K<=0||T<=0||T>10||sigma<=0||sigma>10||r< -1||r>1||q< -1||q>1)
    throw new Error('MONEY_OPTIONS_RISK_MODEL_DOMAIN_INVALID');
  if(input.exerciseStyle!=='AMERICAN'&&input.exerciseStyle!=='EUROPEAN')
    throw new Error('MONEY_OPTIONS_RISK_EXERCISE_STYLE_UNSUPPORTED');
  const rt=Math.sqrt(T),d1=(Math.log(S/K)+(r-q+sigma*sigma/2)*T)/(sigma*rt),d2=d1-sigma*rt;
  const dfq=Math.exp(-q*T),dfr=Math.exp(-r*T),pdf=density(d1);
  const call=right==='CALL';
  const theoreticalPremium=call ? S*dfq*cdf(d1)-K*dfr*cdf(d2):
    K*dfr*cdf(-d2)-S*dfq*cdf(-d1);
  const delta=dfq*(call?cdf(d1):cdf(d1)-1);
  const gamma=dfq*pdf/(S*sigma*rt),vega=S*dfq*pdf*rt;
  const thetaPerYear=-(S*dfq*pdf*sigma)/(2*rt)
    +(call?-r*K*dfr*cdf(d2)+q*S*dfq*cdf(d1):r*K*dfr*cdf(-d2)-q*S*dfq*cdf(-d1));
  const rho=call?K*T*dfr*cdf(d2):-K*T*dfr*cdf(-d2);
  const vannaPerVolatilityUnit=-dfq*pdf*d2/sigma;
  // Calendar-time passage: one day less to expiry, with spot, rates and IV fixed.
  // This is a one-day stress, not continuously annualized 'charm'.
  const charmPerCalendarDay=T>1/365 ? deltaAt(right,S,K,T-1/365,sigma,r,q)-delta : null;
  const result={model:'BLACK_SCHOLES_MERTON_EUROPEAN_PROXY' as const,
    modelApplicability:input.exerciseStyle==='EUROPEAN'?'EUROPEAN' as const:'AMERICAN_APPROXIMATION' as const,
    right,theoreticalPremium:Math.max(0,theoreticalPremium),delta,gamma,vega,thetaPerYear,rho,
    vannaPerVolatilityUnit,charmPerCalendarDay,yearFraction:T};
  if(Object.values(result).some(v=>typeof v==='number'&&!Number.isFinite(v)))
    throw new Error('MONEY_OPTIONS_RISK_OUTPUT_NONFINITE');
  return Object.freeze(result);
}
export function evaluateMoneyOptionsRisk(input:Readonly<{
  chain:MoneyOptionsChain;underlyingInstrumentId:string;underlyingPrice:number;
  riskFreeRate:number;dividendYield:number;
  scenarioPositions:readonly Readonly<{
    optionId:string;openInterest:number;openInterestAsOf:string;
    estimatedDealerContracts?:number;dealerEvidenceId?:string;
  }>[];
  underlyingEvidenceId:string;rateEvidenceId:string;
}>):MoneyOptionsRiskResearch {
  if(!input.chain.options.length)throw new Error('MONEY_OPTIONS_RISK_CHAIN_EMPTY');
  if(input.chain.schemaVersion!==MONEY_OPTION_CHAIN_SCHEMA||input.chain.disposition!=='RESEARCH_ONLY'||
    input.chain.canExecute!==false||input.chain.canAuthorizeLive!==false ||
    !input.underlyingInstrumentId.trim()||!input.underlyingEvidenceId.trim()||!input.rateEvidenceId.trim()||
    !Number.isFinite(input.underlyingPrice)||input.underlyingPrice<=0)
    throw new Error('MONEY_OPTIONS_RISK_RESEARCH_CHAIN_REQUIRED');
  const now=time(input.chain.informationCutoff,'MONEY_OPTIONS_RISK_CUTOFF_INVALID');
  const seen=new Set<string>();
  for(const scenario of input.scenarioPositions){
    if(seen.has(scenario.optionId))throw new Error('MONEY_OPTIONS_RISK_DUPLICATE_POSITION');
    seen.add(scenario.optionId);
    if(!Number.isSafeInteger(scenario.openInterest)||scenario.openInterest<0||
       time(scenario.openInterestAsOf,'MONEY_OPTIONS_RISK_OI_TIME_INVALID')>now)
      throw new Error('MONEY_OPTIONS_RISK_OI_UNAVAILABLE');
    if(scenario.estimatedDealerContracts!==undefined&&(
       !Number.isSafeInteger(scenario.estimatedDealerContracts)||
       Math.abs(scenario.estimatedDealerContracts)>scenario.openInterest||
       !scenario.dealerEvidenceId?.trim()))
      throw new Error('MONEY_OPTIONS_RISK_DEALER_ESTIMATE_UNVERIFIED');
  }
  const rows=input.chain.options.map(row=>{
    if(row.underlyingInstrumentId!==input.underlyingInstrumentId)
      throw new Error('MONEY_OPTIONS_RISK_UNDERLYING_MISMATCH');
    const scenario=input.scenarioPositions.find(x=>x.optionId===row.optionId);
    if(!scenario)throw new Error('MONEY_OPTIONS_RISK_OI_UNAVAILABLE');
    if(row.impliedVolatility===undefined||row.impliedVolatility<=0)
      throw new Error('MONEY_OPTIONS_RISK_IV_REQUIRED');
    const T=(time(row.expirationAt,'MONEY_OPTIONS_RISK_EXPIRY_INVALID')-now)/(365.25*86400000);
    if(T<=0)throw new Error('MONEY_OPTIONS_RISK_EXPIRED_CONTRACT');
    if(row.exerciseStyle==='OTHER'||row.settlementType==='OTHER')throw new Error('MONEY_OPTIONS_RISK_SETTLEMENT_UNSUPPORTED');
    const model=blackScholesResearch({right:row.right,exerciseStyle:row.exerciseStyle,
      spot:input.underlyingPrice,strike:row.strikePrice,yearFraction:T,
      volatility:row.impliedVolatility,riskFreeRate:input.riskFreeRate,dividendYield:input.dividendYield});
    const each=model.gamma*input.underlyingPrice**2*0.01*row.contractMultiplier;
    const known=scenario.estimatedDealerContracts!==undefined;
    const reasons=[...(known?[]:['DEALER_POSITION_UNKNOWN']),
      ...(model.modelApplicability==='AMERICAN_APPROXIMATION'?['EUROPEAN_PROXY_FOR_AMERICAN_OPTION']:[]),
      ...(T<1/365?['ZERO_DTE_GAMMA_UNSTABLE']:[]),...row.reasonCodes];
    return Object.freeze({
      optionId:row.optionId,openInterest:scenario.openInterest,openInterestAsOf:scenario.openInterestAsOf,
      dealerPositionSource:known?'EVIDENCE_BACKED_ESTIMATE' as const:'UNKNOWN' as const,
      assumedDealerContracts:known?scenario.estimatedDealerContracts!:null,
      gexUsdPerOnePctMove:known?scenario.estimatedDealerContracts!*each:null,
      lowerGexUsdPerOnePctMove:-scenario.openInterest*each,
      upperGexUsdPerOnePctMove:scenario.openInterest*each,model,
      reasonCodes:Object.freeze(reasons),authority:'RESEARCH_ONLY' as const,
      canExecute:false as const,canAuthorizeLive:false as const
    });
  });
  const allKnown=rows.every(r=>r.assumedDealerContracts!==null);
  const signed=allKnown?rows.reduce((sum,r)=>sum+r.gexUsdPerOnePctMove!,0):null;
  return Object.freeze({
    schemaVersion:MONEY_OPTIONS_RISK_SCHEMA,sourceId:input.chain.sourceId,
    underlyingInstrumentId:input.underlyingInstrumentId,informationCutoff:input.chain.informationCutoff,
    underlyingPrice:input.underlyingPrice,rows:Object.freeze(rows),
    signedAggregateGexUsdPerOnePctMove:signed,
    boundedGexUsdPerOnePctMove:Object.freeze({
      minimum:rows.reduce((sum,r)=>sum+r.lowerGexUsdPerOnePctMove,0),
      maximum:rows.reduce((sum,r)=>sum+r.upperGexUsdPerOnePctMove,0)}),
    disposition:'CONDITIONAL_SCENARIOS_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:sha({chain:input.chain.evidenceHash,underlying:input.underlyingEvidenceId,
      rate:input.rateEvidenceId,positions:input.scenarioPositions,rows})
  });
}
