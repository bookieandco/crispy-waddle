import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {MoneyLocalForwardJournal,assessMoneyPaperWatchdog} from './money-finish-forward-journal.js';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction,gradeMoneyForwardHorizon,
 type MoneyForwardQuote,type MoneyForwardHorizon
} from './money-finish-forward-grades.js';

const periods:Record<MoneyForwardHorizon,number>={'15m':900000,'1h':3600000,'4h':14400000,
 '24h':86400000,'3d':259200000,'7d':604800000};
const date=(ms:number)=>new Date(ms).toISOString();
const baseTime=Date.parse('2026-10-01T00:01:00Z');
const candidate=registerMoneyStrategy({
 candidateId:'journal:candidate',strategyFamily:'TREND',asset:'STOCK',
 instrumentId:'stock:TEST',methodologyVersion:'v1',sourceSchema:'MONEY-FINISH-08',
 sourceEvidenceIds:['test:evidence'],informationCutoff:'2026-09-30T12:00:00Z',
 createdAt:'2026-09-30T13:00:00Z',parameters:{window:20},maximumDevelopmentTrials:2
});
const entry:MoneyForwardQuote={
 quoteId:'entry:j',instrumentId:'stock:TEST',sourceId:'read-only:verified',
 bid:100,ask:100.2,observedAt:'2026-10-01T00:00:45Z',
 availableAt:'2026-10-01T00:00:48Z',receivedAt:'2026-10-01T00:00:50Z',
 evidenceId:'entry:receipt',provenanceHash:'entry:hash',status:'VERIFIED_READ_ONLY'
};
const prediction=makeMoneyForwardPrediction({
 candidate,predictionId:'prediction:journal',direction:'LONG_BIAS',
 decisionAt:date(baseTime),createdAt:date(baseTime+1000),informationCutoff:date(baseTime-1000),
 entry,informationEvidenceIds:['strategy:decision'],sourceRightsEvidenceId:'rights:proof',
 maximumEntrySpreadBps:100
});
const grades=(['15m','1h','4h','24h','3d','7d'] as const).map(horizon=>{
 const due=baseTime+periods[horizon];
 return gradeMoneyForwardHorizon({prediction,horizon,exit:{
   ...entry,quoteId:'exit:'+horizon,bid:101,ask:101.2,
   observedAt:date(due),availableAt:date(due+1000),receivedAt:date(due+1500),
   evidenceId:'exit:evidence:'+horizon,provenanceHash:'quote:'+horizon
 },gradedAt:date(due+3000),maximumMarkDelayMs:10000,
 maximumExitSpreadBps:100,additionalRoundTripCostBps:4});
});
test('FINISH.14 actual filesystem write/fsync and fresh independent readback prove hash chain',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'money-forward-'));
 try{
   const path=join(dir,'forward.jsonl'),a=new MoneyLocalForwardJournal(path);
   await assert.rejects(()=>a.verifyReadback(),/EMPTY_NOT_COMMISSIONED/);
   const first=await a.append(grades[0]!);
   assert.equal(first.disposition,'INSERTED');
   const replay=await a.append(grades[0]!);
   assert.equal(replay.disposition,'REPLAY');
   assert.equal(replay.eventHash,first.eventHash);
   const b=new MoneyLocalForwardJournal(path);
   for(const g of grades.slice(1))await b.append(g);
   const proof=await (new MoneyLocalForwardJournal(path)).verifyReadback();
   assert.equal(proof.count,6);
   assert.equal(proof.gradeIds.length,6);
   assert.equal(proof.eventHashes[0],first.eventHash);
   assert.equal(proof.tailHash,proof.eventHashes.at(-1));
   assert.equal((await a.list()).length,6);
   await assert.rejects(()=>a.append({...grades[0]!,netReturnBps:100}),/TAMPERED/);
   const cycles=[2,4,6].map((count,i)=>({
     cycleId:'cycle:'+count,completedAt:date(Date.parse('2026-10-09T00:00:00Z')+i*3600000),
     journalTailHash:proof.eventHashes[count-1]!,journalCount:count,
     evidenceIds:['checkpoint:'+count],realFeedOrigin:'SYNTHETIC_FIXTURE' as const,
     isolatedIndependentReadback:true
   }));
   const state=assessMoneyPaperWatchdog({cycles,readback:proof,grades,
     asOf:'2026-10-10T00:00:00Z',minimumCycles:3,maxCycleGapMs:7200000,
     providerEntitlementVerified:false,originalShadowStoreRecovered:false});
   assert.equal(state.state,'AUDIT_REPAIR_REQUIRED');
   assert.ok(state.reasonCodes.includes('ORIGINAL_SHADOW_RESTORE_UNVERIFIED'));
   assert.ok(state.reasonCodes.includes('CYCLE_USES_SYNTHETIC_OR_UNVERIFIED_EVIDENCE'));
   assert.equal(state.horizonCoverage.length,6);
   assert.equal(state.canAuthorizeLive,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('FINISH.14 local journal detects tamper/truncation and refuses duplicate conflicting grade',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'money-forward-bad-'));
 try{
   const file=join(dir,'grades.jsonl'),j=new MoneyLocalForwardJournal(file);
   await j.append(grades[0]!);
   const original=await readFile(file,'utf8');
   await writeFile(file,original.replace('"grossReturnBps":', '"forgedReturn":'));
   await assert.rejects(()=>j.verifyReadback(),/TAMPERED|HASH_INVALID/);
   await writeFile(file,original.trimEnd());
   await assert.rejects(()=>j.verifyReadback(),/PARTIAL_WRITE/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('FINISH.14 watchdog catches fabricated cycles, non-advancing hashes and missing horizons',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'money-forward-watch-'));
 try{
  const file=join(dir,'journal.jsonl'),j=new MoneyLocalForwardJournal(file);
  await j.append(grades[0]!);
  const proof=await j.verifyReadback();
  const cycles=[1,2,3].map((i)=>({
    cycleId:'cycle:'+i,completedAt:date(Date.parse('2026-10-09T00:00:00Z')+i*3600000),
    journalTailHash:proof.tailHash,journalCount:1,evidenceIds:['cycle:proof'],
    realFeedOrigin:'LICENSED_READ_ONLY' as const,isolatedIndependentReadback:true
  }));
  const result=assessMoneyPaperWatchdog({cycles,readback:proof,grades:grades.slice(0,1),
    asOf:'2026-10-10T00:00:00Z',minimumCycles:3,maxCycleGapMs:7200000,
    providerEntitlementVerified:true,originalShadowStoreRecovered:true});
  assert.equal(result.state,'AUDIT_REPAIR_REQUIRED');
  assert.ok(result.reasonCodes.includes('CYCLE_DID_NOT_ADVANCE_VERIFIED_JOURNAL'));
  assert.ok(result.reasonCodes.includes('MISSING_HORIZON_7D'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
