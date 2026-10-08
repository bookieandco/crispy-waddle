import {createHash} from 'node:crypto';
import type {ResearchCandle} from './money-finish-signal-league.js';

export const MONEY_FX_CHALLENGER_SCHEMA='MONEY-FINISH-10' as const;
export type FxTrainingCase=Readonly<{
  caseId:string;pairId:string;decisionAt:string;featuresAvailableAt:string;
  features:Readonly<{momentum20:number;carryDifferential:number;realizedVolatility:number;spreadPips:number}>;
  featureEvidenceRefs:readonly string[];
  entryMid:number;exitMid:number;outcomeAt:string;outcomeAvailableAt:string;
  outcomeEvidenceRef:string;datasetProvenanceHash:string;
}>;
export type FxProspectiveFeature=Readonly<{
  pairId:string;decisionAt:string;featuresAvailableAt:string;
  features:FxTrainingCase['features'];featureEvidenceRefs:readonly string[];
  datasetProvenanceHash:string;
}>;
export type FxChallengerStudy=Readonly<{
  schemaVersion:typeof MONEY_FX_CHALLENGER_SCHEMA;pairId:string;
  trainCases:number;heldoutCases:number;embargoMs:number;
  cutoff:string;lastTrainOutcomeAt:string;firstHeldoutDecisionAt:string;
  logisticCoefficients:readonly number[];trainingMeans:readonly number[];
  trainingScales:readonly number[];heldoutBrier:number;heldoutLogLoss:number;
  neutralBrier:number;historicalBaseRateBrier:number;
  calibrationStatus:'NOT_CERTIFIED';
  evidenceHash:string;authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type FxForecastChallenger=Readonly<{
  pairId:string;decisionAt:string;probabilityUp:number;
  baseRateUp:number;status:'RESEARCH_UNCALIBRATED';
  studyEvidenceHash:string;featureEvidenceRefs:readonly string[];
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;
}>;
export type FxHistoricalAnalog=Readonly<{
  matchedAt:string;prefixDistance:number;futureReturn:number;evidenceIds:readonly string[];
}>;
export type FxAnalogResearch=Readonly<{
  schemaVersion:typeof MONEY_FX_CHALLENGER_SCHEMA;
  instrumentId:string;decisionAt:string;analogues:readonly FxHistoricalAnalog[];
  medianReturn:number|null;lowerReturn:number|null;upperReturn:number|null;
  positiveFraction:number|null;status:'INSUFFICIENT_EVIDENCE'|'RESEARCH_UNCALIBRATED';
  authority:'RESEARCH_ONLY';canExecute:false;canAuthorizeLive:false;evidenceHash:string;
}>;
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function t(x:string,code:string){const n=Date.parse(x);if(!x||!Number.isFinite(n))throw new Error(code);return n;}
function featureArray(f:FxTrainingCase['features']):number[]{
  const xs=[f.momentum20,f.carryDifferential,f.realizedVolatility,f.spreadPips];
  if(xs.some(x=>!Number.isFinite(x))||f.realizedVolatility<0||f.spreadPips<0)
    throw new Error('MONEY_FX_ML_FEATURES_INVALID');
  return xs;
}
function verifyCase(c:FxTrainingCase,cutoff:number){
  if(!c.caseId.trim()||!c.pairId.trim()||!c.datasetProvenanceHash.trim()||
     !c.featureEvidenceRefs.length||!c.outcomeEvidenceRef.trim())
    throw new Error('MONEY_FX_ML_PROVENANCE_MISSING');
  const d=t(c.decisionAt,'MONEY_FX_ML_DECISION_TIME_INVALID');
  const f=t(c.featuresAvailableAt,'MONEY_FX_ML_FEATURE_TIME_INVALID');
  const y=t(c.outcomeAt,'MONEY_FX_ML_OUTCOME_TIME_INVALID');
  const a=t(c.outcomeAvailableAt,'MONEY_FX_ML_LABEL_TIME_INVALID');
  if(f>d||y<=d||a<y||a>cutoff)throw new Error('MONEY_FX_ML_FUTURE_OR_UNMATURED_LABEL');
  if(!Number.isFinite(c.entryMid)||!Number.isFinite(c.exitMid)||c.entryMid<=0||c.exitMid<=0)
    throw new Error('MONEY_FX_ML_PRICE_INVALID');
  featureArray(c.features);
}
function target(c:FxTrainingCase):number{return c.exitMid>c.entryMid?1:0;}
function sigmoid(x:number):number{const z=Math.min(40,Math.max(-40,x));return 1/(1+Math.exp(-z));}
function predict(weights:readonly number[],xs:readonly number[]):number{
  return sigmoid(weights[0]!+xs.reduce((s,x,j)=>s+weights[j+1]!*x,0));
}
function normalized(xs:readonly number[],means:readonly number[],scales:readonly number[]){
  return xs.map((x,i)=>(x-means[i]!)/scales[i]!);
}
export function trainFxTemporalChallenger(input:Readonly<{
  pairId:string;train:readonly FxTrainingCase[];heldout:readonly FxTrainingCase[];
  informationCutoff:string;embargoMs:number;minTrainCases:number;minHeldoutCases:number;
}>):FxChallengerStudy {
  const cutoff=t(input.informationCutoff,'MONEY_FX_ML_CUTOFF_INVALID');
  if(!input.pairId.trim()||!Number.isSafeInteger(input.embargoMs)||input.embargoMs<0||
     !Number.isSafeInteger(input.minTrainCases)||input.minTrainCases<30||
     !Number.isSafeInteger(input.minHeldoutCases)||input.minHeldoutCases<10||
     input.train.length<input.minTrainCases||input.heldout.length<input.minHeldoutCases)
    throw new Error('MONEY_FX_ML_INSUFFICIENT_SAMPLES');
  const all=[...input.train,...input.heldout];
  const ids=new Set<string>();
  let prevTrain=-Infinity,prevHold=-Infinity;
  for(let i=0;i<all.length;i++){
    const c=all[i]!;
    verifyCase(c,cutoff);
    if(c.pairId!==input.pairId||ids.has(c.caseId))throw new Error('MONEY_FX_ML_IDENTITY_OR_OVERLAP');
    ids.add(c.caseId);
    const d=t(c.decisionAt,'MONEY_FX_ML_DECISION_TIME_INVALID');
    if(i<input.train.length){if(d<=prevTrain)throw new Error('MONEY_FX_ML_TRAIN_CHRONOLOGY');prevTrain=d;}
    else{if(d<=prevHold)throw new Error('MONEY_FX_ML_HOLDOUT_CHRONOLOGY');prevHold=d;}
  }
  const latestTrainOutcome=Math.max(...input.train.map(c=>t(c.outcomeAvailableAt,'MONEY_FX_ML_LABEL_TIME_INVALID')));
  const firstHold=t(input.heldout[0]!.decisionAt,'MONEY_FX_ML_HOLDOUT_TIME_INVALID');
  if(latestTrainOutcome+input.embargoMs>firstHold)
    throw new Error('MONEY_FX_ML_PURGE_OR_EMBARGO_VIOLATION');
  // Train-only normalization; neither heldout nor prospect data adjusts scales.
  const raw=input.train.map(c=>featureArray(c.features));
  const means=[0,1,2,3].map(j=>raw.reduce((s,x)=>s+x[j]!,0)/raw.length);
  const scales=[0,1,2,3].map(j=>Math.max(1e-9,Math.sqrt(
    raw.reduce((s,x)=>s+(x[j]!-means[j]!)**2,0)/raw.length)));
  const normalizedTrain=raw.map(x=>normalized(x,means,scales));
  const weights=[0,0,0,0,0];
  const labels=input.train.map(target);
  for(let epoch=0;epoch<350;epoch++){
    const grad=[0,0,0,0,0];
    for(let i=0;i<normalizedTrain.length;i++){
      const x=normalizedTrain[i]!,err=predict(weights,x)-labels[i]!;
      grad[0]!+=err;
      for(let j=0;j<4;j++)grad[j+1]!+=err*x[j]!;
    }
    for(let j=0;j<5;j++){
      const penalize=j===0?0:0.02*weights[j]!;
      weights[j]!-=0.1*(grad[j]!/normalizedTrain.length+penalize);
    }
  }
  const baseRate=labels.reduce((s,x)=>s+x,0)/labels.length;
  let brier=0,logloss=0,neutral=0,baseline=0;
  for(const c of input.heldout){
    const y=target(c),p=predict(weights,normalized(featureArray(c.features),means,scales));
    brier+=(p-y)**2;neutral+=(0.5-y)**2;baseline+=(baseRate-y)**2;
    logloss+=-(y*Math.log(Math.max(1e-12,p))+(1-y)*Math.log(Math.max(1e-12,1-p)));
  }
  const m=input.heldout.length;
  return Object.freeze({
    schemaVersion:MONEY_FX_CHALLENGER_SCHEMA,pairId:input.pairId,
    trainCases:input.train.length,heldoutCases:m,embargoMs:input.embargoMs,
    cutoff:input.informationCutoff,lastTrainOutcomeAt:new Date(latestTrainOutcome).toISOString(),
    firstHeldoutDecisionAt:input.heldout[0]!.decisionAt,
    logisticCoefficients:Object.freeze(weights),trainingMeans:Object.freeze(means),trainingScales:Object.freeze(scales),
    heldoutBrier:brier/m,heldoutLogLoss:logloss/m,neutralBrier:neutral/m,historicalBaseRateBrier:baseline/m,
    calibrationStatus:'NOT_CERTIFIED',authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:sha({pair:input.pairId,cutoff,train:input.train.map(c=>[c.caseId,c.datasetProvenanceHash,c.outcomeEvidenceRef]),
      heldout:input.heldout.map(c=>[c.caseId,c.datasetProvenanceHash,c.outcomeEvidenceRef]),weights,means,scales})
  });
}
export function forecastFxChallenger(input:Readonly<{
  study:FxChallengerStudy;trainingBaseRateUp:number;prospect:FxProspectiveFeature;
}>):FxForecastChallenger {
  if(input.study.schemaVersion!==MONEY_FX_CHALLENGER_SCHEMA||
     input.study.authority!=='RESEARCH_ONLY'||input.study.canExecute!==false||
     input.prospect.pairId!==input.study.pairId||!input.prospect.datasetProvenanceHash.trim()||
     !input.prospect.featureEvidenceRefs.length)
    throw new Error('MONEY_FX_ML_FORECAST_PROVENANCE_INVALID');
  const d=t(input.prospect.decisionAt,'MONEY_FX_ML_PROSPECT_TIME_INVALID');
  if(t(input.prospect.featuresAvailableAt,'MONEY_FX_ML_PROSPECT_FEATURE_TIME_INVALID')>d ||
     d<t(input.study.firstHeldoutDecisionAt,'MONEY_FX_ML_PROSPECT_TIME_INVALID'))
    throw new Error('MONEY_FX_ML_PROSPECT_FEATURE_LEAK');
  if(!Number.isFinite(input.trainingBaseRateUp)||input.trainingBaseRateUp<0||input.trainingBaseRateUp>1)
    throw new Error('MONEY_FX_ML_BASE_RATE_INVALID');
  return Object.freeze({pairId:input.study.pairId,decisionAt:input.prospect.decisionAt,
    probabilityUp:predict(input.study.logisticCoefficients,
      normalized(featureArray(input.prospect.features),input.study.trainingMeans,input.study.trainingScales)),
    baseRateUp:input.trainingBaseRateUp,status:'RESEARCH_UNCALIBRATED',
    studyEvidenceHash:input.study.evidenceHash,featureEvidenceRefs:Object.freeze([...input.prospect.featureEvidenceRefs]),
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
}
function quantile(xs:readonly number[],q:number):number{
  const sorted=[...xs].sort((a,b)=>a-b),p=(sorted.length-1)*q,a=Math.floor(p),b=Math.ceil(p);
  return sorted[a]!+(sorted[b]!-sorted[a]!)*(p-a);
}
export function studyFxHistoricalAnalogues(input:Readonly<{
  candles:readonly ResearchCandle[];instrumentId:string;
  sourceId:string;informationCutoff:string;sourceReviewEvidenceId:string;
  lookback:number;horizon:number;maximumMatches:number;minimumMatches:number;
}>):FxAnalogResearch {
  const cutoff=t(input.informationCutoff,'MONEY_FX_ANALOG_CUTOFF_INVALID');
  if(!input.instrumentId.trim()||!input.sourceId.trim()||!input.sourceReviewEvidenceId.trim()||
     !Number.isSafeInteger(input.lookback)||input.lookback<5||
     !Number.isSafeInteger(input.horizon)||input.horizon<1||
     !Number.isSafeInteger(input.maximumMatches)||input.maximumMatches<1||
     !Number.isSafeInteger(input.minimumMatches)||input.minimumMatches<3||
     input.maximumMatches<input.minimumMatches)
    throw new Error('MONEY_FX_ANALOG_POLICY_INVALID');
  const candles=input.candles;const seen=new Set<string>();let lastEnd=-Infinity;
  for(const bar of candles){
    const open=t(bar.openedAt,'MONEY_FX_ANALOG_OPEN_INVALID');
    const end=t(bar.closedAt,'MONEY_FX_ANALOG_CLOSED_INVALID');
    const avail=t(bar.availableAt,'MONEY_FX_ANALOG_AVAILABLE_INVALID');
    const received=t(bar.receivedAt,'MONEY_FX_ANALOG_RECEIVED_INVALID');
    if(open<lastEnd||end<=open||end>avail||avail>received||received>cutoff ||
       bar.sourceId!==input.sourceId||bar.instrumentId!==input.instrumentId||
       !Number.isFinite(bar.close)||bar.close<=0||!bar.evidenceRef.trim()||
       !bar.provenanceHash.trim()||seen.has(bar.evidenceRef))
      throw new Error('MONEY_FX_ANALOG_INVALID_OR_FUTURE_CANDLE');
    lastEnd=end;seen.add(bar.evidenceRef);
  }
  const n=candles.length;
  if(n<input.lookback+input.horizon+input.minimumMatches)
    throw new Error('MONEY_FX_ANALOG_NOT_ENOUGH_HISTORY');
  const sample=candles.slice(-input.lookback);
  const start=sample[0]!.close;
  const samplePath=sample.map(c=>Math.log(c.close/start));
  const ranked:{start:number;end:number;distance:number;futureReturn:number}[]=[];
  // Historical window must have its complete outcome before the current pattern begins.
  const latestStart=n-2*input.lookback-input.horizon;
  for(let i=0;i<=latestStart;i++){
    const window=candles.slice(i,i+input.lookback);
    const base=window[0]!.close;
    const distance=Math.sqrt(window.reduce((sum,c,j)=>
      sum+(Math.log(c.close/base)-samplePath[j]!)**2,0)/input.lookback);
    const finish=i+input.lookback-1,exit=finish+input.horizon;
    ranked.push({start:i,end:exit,distance,
      futureReturn:candles[exit]!.close/window.at(-1)!.close-1});
  }
  ranked.sort((a,b)=>a.distance-b.distance||a.start-b.start);
  const selected:typeof ranked=[];
  for(const item of ranked){
    if(selected.some(other=>item.start<=other.end&&other.start<=item.end))continue;
    selected.push(item);
    if(selected.length===input.maximumMatches)break;
  }
  const analogues=selected.map(item=>Object.freeze({matchedAt:candles[item.end]!.closedAt,
    prefixDistance:item.distance,futureReturn:item.futureReturn,
    evidenceIds:Object.freeze([candles[item.start]!.evidenceRef,candles[item.end]!.evidenceRef])}));
  const sufficient=analogues.length>=input.minimumMatches;
  const returns=analogues.map(a=>a.futureReturn);
  return Object.freeze({schemaVersion:MONEY_FX_CHALLENGER_SCHEMA,instrumentId:input.instrumentId,
    decisionAt:candles.at(-1)!.closedAt,analogues:Object.freeze(analogues),
    medianReturn:sufficient?quantile(returns,0.5):null,
    lowerReturn:sufficient?quantile(returns,0.1):null,
    upperReturn:sufficient?quantile(returns,0.9):null,
    positiveFraction:sufficient?returns.filter(x=>x>0).length/returns.length:null,
    status:sufficient?'RESEARCH_UNCALIBRATED':'INSUFFICIENT_EVIDENCE',
    authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
    evidenceHash:sha({cutoff,source:input.sourceId,review:input.sourceReviewEvidenceId,
      lookback:input.lookback,horizon:input.horizon,evidence:candles.map(c=>c.provenanceHash),analogues})});
}
