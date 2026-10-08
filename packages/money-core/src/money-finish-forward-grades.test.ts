import test from 'node:test';
import assert from 'node:assert/strict';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction,gradeMoneyForwardHorizon,assertMoneyForwardGrade,
 type MoneyForwardQuote,type MoneyForwardHorizon
} from './money-finish-forward-grades.js';
const candidate=registerMoneyStrategy({
 candidateId:'forward:1',strategyFamily:'TREND',asset:'STOCK',instrumentId:'stock:TEST',
 methodologyVersion:'v1',sourceSchema:'MONEY-FINISH-08',
 informationCutoff:'2026-09-30T23:00:00Z',createdAt:'2026-09-30T23:30:00Z',
 parameters:{sma:20},maximumDevelopmentTrials:2,sourceEvidenceIds:['rights:baseline']
});
const decision='2026-10-01T00:01:00Z',cutoff='2026-10-01T00:00:59Z';
const entry:MoneyForwardQuote={
 quoteId:'entry:1',instrumentId:'stock:TEST',sourceId:'licensed:read-only',
 bid:99.9,ask:100.1,observedAt:'2026-10-01T00:00:50Z',
 availableAt:'2026-10-01T00:00:53Z',receivedAt:'2026-10-01T00:00:55Z',
 evidenceId:'licensed:entry',provenanceHash:'entry:sha',status:'VERIFIED_READ_ONLY'
};
export const horizons:Readonly<Record<MoneyForwardHorizon,number>>={
 '15m':900000,'1h':3600000,'4h':14400000,'24h':86400000,'3d':259200000,'7d':604800000
};
const instant=(ms:number)=>new Date(ms).toISOString();
const prediction=makeMoneyForwardPrediction({candidate,predictionId:'pred:1',
 direction:'LONG_BIAS',decisionAt:decision,createdAt:'2026-10-01T00:01:01Z',
 informationCutoff:cutoff,entry,informationEvidenceIds:['signal:proof'],
 sourceRightsEvidenceId:'terms:verified',maximumEntrySpreadBps:100});
const makeGrade=(h:MoneyForwardHorizon)=> {
 const due=Date.parse(decision)+horizons[h];
 const exit:MoneyForwardQuote={...entry,quoteId:'exit:'+h,bid:102,ask:102.2,
   observedAt:instant(due),availableAt:instant(due+1000),
   receivedAt:instant(due+1500),evidenceId:'mark:'+h,provenanceHash:'markhash:'+h};
 return gradeMoneyForwardHorizon({prediction,horizon:h,exit,
   gradedAt:instant(due+2000),maximumMarkDelayMs:30000,
   maximumExitSpreadBps:100,additionalRoundTripCostBps:5});
};
test('FINISH.14 all six time-aligned horizons produce separately hashed, research-only grades',()=>{
 const grades=(['15m','1h','4h','24h','3d','7d'] as const).map(makeGrade);
 assert.equal(grades.length,6);
 assert.equal(new Set(grades.map(g=>g.gradeId)).size,6);
 assert.ok(grades.every(g=>g.netReturnBps<g.grossReturnBps && !g.canExecute));
 for(const grade of grades)assert.doesNotThrow(()=>assertMoneyForwardGrade(grade));
 const observed=grades.find(g=>g.horizon==='15m')!;
 const want=(102-100.1)/100.1*10000-5;
 assert.ok(Math.abs(observed.netReturnBps-want)<1e-9);
 assert.throws(()=>assertMoneyForwardGrade({...observed,netReturnBps:3000}),/TAMPERED/);
});
test('FINISH.14 never grades before due time or from delayed/future/unavailable marks',()=>{
 const at=Date.parse(decision)+horizons['15m'];
 const original:MoneyForwardQuote={...entry,quoteId:'next',
   observedAt:instant(at),availableAt:instant(at+1000),receivedAt:instant(at+1500),
   evidenceId:'mark',provenanceHash:'next:sha'};
 const call=(exit:MoneyForwardQuote,gradedAt:string,maximumMarkDelayMs=30000)=>
   gradeMoneyForwardHorizon({prediction,horizon:'15m',exit,gradedAt,
     maximumMarkDelayMs,maximumExitSpreadBps:200,additionalRoundTripCostBps:3});
 assert.throws(()=>call(original,instant(at-1)),/EARLY_OR_STALE_HORIZON/);
 assert.throws(()=>call({...original,observedAt:instant(at-1)},
   instant(at+2000)),/EARLY_OR_STALE_HORIZON/);
 assert.throws(()=>call({...original,observedAt:instant(at+90000),
   availableAt:instant(at+90001),receivedAt:instant(at+90002)},
   instant(at+95000)),/EARLY_OR_STALE_HORIZON/);
 assert.throws(()=>call({...original,receivedAt:instant(at+90000)},
   instant(at+2000)),/FUTURE_OR_UNAVAILABLE_QUOTE/);
 assert.throws(()=>call({...original,quoteId:entry.quoteId},
   instant(at+2000)),/EXIT_IDENTITY_INVALID/);
});
test('FINISH.14 requires decision-time source rights and no future entry quote',()=>{
 assert.throws(()=>makeMoneyForwardPrediction({candidate,predictionId:'pred:bad',
 direction:'LONG_BIAS',decisionAt:decision,createdAt:'2026-10-01T00:01:01Z',
 informationCutoff:cutoff,entry:{...entry,receivedAt:'2026-10-02T00:00:00Z'},
 informationEvidenceIds:['signal:proof'],sourceRightsEvidenceId:'terms:verified',
 maximumEntrySpreadBps:100}),/FUTURE_OR_UNAVAILABLE_QUOTE/);
 assert.throws(()=>makeMoneyForwardPrediction({candidate,predictionId:'pred:bad',
 direction:'LONG_BIAS',decisionAt:decision,createdAt:'2026-10-01T00:01:01Z',
 informationCutoff:cutoff,entry,informationEvidenceIds:['signal:proof'],
 sourceRightsEvidenceId:'',maximumEntrySpreadBps:100}),/PREDICTION_INPUT_INVALID/);
});
test('FINISH.14 counterfactual NO_TRADE has zero outcome and cannot produce real fills',()=>{
 const flat=makeMoneyForwardPrediction({candidate,predictionId:'pred:none',
 direction:'NO_TRADE',decisionAt:decision,createdAt:'2026-10-01T00:01:01Z',
 informationCutoff:cutoff,entry,informationEvidenceIds:['signal:proof'],
 sourceRightsEvidenceId:'rights:yes',maximumEntrySpreadBps:100});
 const due=Date.parse(decision)+900000;
 const exit={...entry,quoteId:'exit:none',observedAt:instant(due),
   availableAt:instant(due+1000),receivedAt:instant(due+1500)};
 const g=gradeMoneyForwardHorizon({prediction:flat,horizon:'15m',exit,
  gradedAt:instant(due+2000),maximumMarkDelayMs:3000,maximumExitSpreadBps:100,
  additionalRoundTripCostBps:99});
 assert.equal(g.netReturnBps,0);
 assert.equal(g.costBps,0);
 assert.equal(g.proof,'FORWARD_PAPER_EVIDENCE_ONLY');
});
