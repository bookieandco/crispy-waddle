import test from 'node:test';
import assert from 'node:assert/strict';
import {trainFxTemporalChallenger,forecastFxChallenger,studyFxHistoricalAnalogues,
  type FxTrainingCase} from './money-finish-fx-challengers.js';
import type {ResearchCandle} from './money-finish-signal-league.js';

const day=86400000;
const dt=(n:number)=>new Date(Date.UTC(2026,0,1)+n*day).toISOString();
function example(i:number):FxTrainingCase{
  const v=Math.sin(i/3),entry=1.1+i/10000;
  return {caseId:'fx:'+i,pairId:'fx:EURUSD',decisionAt:dt(i),
    featuresAvailableAt:dt(i),features:{momentum20:v*0.01,
      carryDifferential:0.01,realizedVolatility:0.009,spreadPips:1.2},
    featureEvidenceRefs:['feature:'+i],entryMid:entry,
    exitMid:entry+(v>=0?0.001:-0.001),outcomeAt:dt(i+1),outcomeAvailableAt:dt(i+1),
    outcomeEvidenceRef:'label:'+i,datasetProvenanceHash:'dataset:'+i};
}
const train=Array.from({length:40},(_,i)=>example(i+1));
const heldout=Array.from({length:12},(_,i)=>example(i+52));
const input={pairId:'fx:EURUSD',train,heldout,informationCutoff:dt(80),embargoMs:2*day,
  minTrainCases:30,minHeldoutCases:10};
test('FINISH.10 supervised challenger trains only on history, scores untouched holdout',()=>{
  const out=trainFxTemporalChallenger(input);
  assert.equal(out.calibrationStatus,'NOT_CERTIFIED');
  assert.equal(out.trainCases,40);assert.equal(out.heldoutCases,12);
  assert.ok(out.heldoutBrier>=0&&out.heldoutBrier<=1);
  assert.ok(out.heldoutLogLoss>=0);
  assert.equal(out.neutralBrier,0.25);
  assert.equal(out.canExecute,false);
  const altered=trainFxTemporalChallenger({...input,heldout:heldout.map(c=>({...c,
    exitMid:c.entryMid+(c.exitMid>c.entryMid?-0.002:0.002)}))});
  assert.deepEqual(out.logisticCoefficients,altered.logisticCoefficients);
  assert.deepEqual(out.trainingMeans,altered.trainingMeans);
  assert.notEqual(out.heldoutBrier,altered.heldoutBrier);
});
test('FINISH.10 purges train labels that overlap heldout and rejects future features',()=>{
  assert.throws(()=>trainFxTemporalChallenger({...input,train:[
    ...train.slice(0,-1),{...train[39]!,outcomeAt:dt(54),outcomeAvailableAt:dt(54)}]}),
    /PURGE_OR_EMBARGO_VIOLATION/);
  assert.throws(()=>trainFxTemporalChallenger({...input,heldout:[
    {...heldout[0]!,featuresAvailableAt:dt(55)},...heldout.slice(1)]}),/FUTURE_OR_UNMATURED_LABEL/);
  assert.throws(()=>trainFxTemporalChallenger({...input,heldout:[
    {...heldout[0]!,caseId:train[0]!.caseId},...heldout.slice(1)]}),/IDENTITY_OR_OVERLAP/);
  assert.throws(()=>trainFxTemporalChallenger({...input,informationCutoff:dt(54)}),/FUTURE_OR_UNMATURED_LABEL/);
});
test('FINISH.10 prospective forecast cannot use pre-study feature timestamps or become authority',()=>{
  const study=trainFxTemporalChallenger(input);
  const prospect={pairId:'fx:EURUSD',decisionAt:dt(83),featuresAvailableAt:dt(83),
    features:example(83).features,featureEvidenceRefs:['feature:83'],datasetProvenanceHash:'proof:83'};
  const out=forecastFxChallenger({study,trainingBaseRateUp:0.5,prospect});
  assert.ok(out.probabilityUp>0&&out.probabilityUp<1);
  assert.equal(out.status,'RESEARCH_UNCALIBRATED');assert.equal(out.canAuthorizeLive,false);
  assert.throws(()=>forecastFxChallenger({study,trainingBaseRateUp:0.5,
    prospect:{...prospect,decisionAt:dt(70),featuresAvailableAt:dt(70)}}),/PROSPECT_FEATURE_LEAK/);
  assert.throws(()=>forecastFxChallenger({study,trainingBaseRateUp:0.5,
    prospect:{...prospect,featuresAvailableAt:dt(84)}}),/PROSPECT_FEATURE_LEAK/);
});
function candles(n:number):ResearchCandle[]{
  return Array.from({length:n},(_,i)=>{const price=1.1+0.0003*i+0.02*Math.sin(i/5);
    return {instrumentId:'fx:EURUSD',sourceId:'fx:archive',interval:'1D',
      openedAt:dt(i),closedAt:dt(i+1),availableAt:dt(i+1),receivedAt:dt(i+1),
      open:price,high:price+0.002,low:price-0.002,close:price,
      evidenceRef:'historical:'+i,provenanceHash:'h:'+i};
  });
}
const analogParams={instrumentId:'fx:EURUSD',sourceId:'fx:archive',informationCutoff:dt(200),
  sourceReviewEvidenceId:'rights:archive',lookback:10,horizon:3,maximumMatches:5,minimumMatches:3};
test('FINISH.10 historical analogues use disjoint historical outcomes and never report certified odds',()=>{
  const xs=candles(160);
  const a=studyFxHistoricalAnalogues({...analogParams,candles:xs});
  const b=studyFxHistoricalAnalogues({...analogParams,candles:xs});
  assert.equal(a.evidenceHash,b.evidenceHash);
  assert.equal(a.status,'RESEARCH_UNCALIBRATED');
  assert.ok(a.analogues.length>=3&&a.analogues.length<=5);
  assert.ok(a.analogues.every(x=>Date.parse(x.matchedAt)<Date.parse(xs[150]!.closedAt)));
  assert.equal(a.canExecute,false);
  assert.ok(a.lowerReturn!<=a.upperReturn!);
});
test('FINISH.10 analogues reject future observation and insufficient independent analogues',()=>{
  const xs=candles(160);
  assert.throws(()=>studyFxHistoricalAnalogues({...analogParams,candles:[
    ...xs.slice(0,-1),{...xs.at(-1)!,availableAt:dt(300),receivedAt:dt(300)}]}),/INVALID_OR_FUTURE_CANDLE/);
  const few=studyFxHistoricalAnalogues({...analogParams,candles:xs,
    lookback:32,horizon:8,maximumMatches:6,minimumMatches:6});
  assert.equal(few.status,'INSUFFICIENT_EVIDENCE');
  assert.equal(few.medianReturn,null);
});
