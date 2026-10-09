import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {registerMoneyStrategy} from './money-finish-strategy-factory.js';
import {makeMoneyForwardPrediction,MONEY_FORWARD_HORIZONS,
  type MoneyForwardQuote,type MoneyForwardHorizon} from './money-finish-forward-grades.js';
import {MoneyLocalForwardJournal} from './money-finish-forward-journal.js';
import {MoneyForwardResearchQueue,gradeMoneyForwardResearchCycle,
  type ForwardProviderReceipt} from './money-forward-durable-research-cycles.js';

const date=(n:number)=>new Date(n).toISOString();
const decision=Date.parse('2026-10-09T12:00:00Z');
const periods:Record<MoneyForwardHorizon,number>={
  '15m':900000,'1h':3600000,'4h':14400000,'24h':86400000,'3d':259200000,'7d':604800000
};
const candidate=registerMoneyStrategy({
  candidateId:'portable:study:1',strategyFamily:'TREND',asset:'STOCK',
  instrumentId:'stock:TEST',methodologyVersion:'research-only-v1',sourceSchema:'MONEY-FINISH-08',
  informationCutoff:'2026-10-08T11:00:00Z',createdAt:'2026-10-08T12:00:00Z',
  sourceEvidenceIds:['human:license-review'],parameters:{sma:20},maximumDevelopmentTrials:2
});
const entry:MoneyForwardQuote={
  quoteId:'q:entry',instrumentId:'stock:TEST',sourceId:'licensed:read',
  observedAt:date(decision-6000),availableAt:date(decision-5000),receivedAt:date(decision-4000),
  bid:99.9,ask:100.1,evidenceId:'quote:entry',provenanceHash:'entry:rawhash',
  status:'VERIFIED_READ_ONLY'
};
const prediction=makeMoneyForwardPrediction({candidate,predictionId:'pred:portable:1',
  direction:'LONG_BIAS',decisionAt:date(decision),createdAt:date(decision+1000),
  informationCutoff:date(decision-3000),entry,informationEvidenceIds:['study:1'],
  sourceRightsEvidenceId:'entitlement:reviewed',maximumEntrySpreadBps:100});
const receipt:ForwardProviderReceipt={
  sourceId:entry.sourceId,entitlementEvidenceId:'license:verified',
  sourceObservationReceiptId:'provider:snapshot:1',origin:'LICENSED_READ_ONLY',
  checkedByIndependentOperator:true,canExecute:false
};
const marks=MONEY_FORWARD_HORIZONS.map(h=>{
  const due=decision+periods[h];
  return {...entry,quoteId:'q:'+h,observedAt:date(due),availableAt:date(due+1000),
    receivedAt:date(due+2000),evidenceId:'mark:'+h,provenanceHash:'mark:source:'+h,
    bid:102,ask:102.2};
});
const setup=async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portable-money-'));
  return {dir,queue:new MoneyForwardResearchQueue(join(dir,'forward-predictions.jsonl')),
    journal:new MoneyLocalForwardJournal(join(dir,'forward-grades.jsonl'))};
};
const cycle=(env:Awaited<ReturnType<typeof setup>>,asOf:string,quotes:readonly MoneyForwardQuote[],
  providers:readonly ForwardProviderReceipt[]=[receipt])=>gradeMoneyForwardResearchCycle({
    queue:env.queue,journal:env.journal,asOf,quoteEvidence:quotes,providers,
    maximumMarkDelayMs:30000,maximumExitSpreadBps:100,additionalRoundTripCostBps:5
  });
test('independent host restart can read identical registered research predictions; conflicts fail',async()=>{
  const env=await setup();
  try{
    const a=await env.queue.register(prediction);
    assert.equal(a.disposition,'INSERTED');
    const b=await (new MoneyForwardResearchQueue(env.queue.path)).register(prediction);
    assert.equal(b.disposition,'REPLAY');
    assert.equal(a.eventHash,b.eventHash);
    assert.equal((await (new MoneyForwardResearchQueue(env.queue.path)).list()).length,1);
    await assert.rejects(()=>env.queue.register({...prediction,direction:'SHORT_BIAS'}),
      /MONEY_PORTABLE_PREDICTION_REPLAY_CONFLICT/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('due horizons remain pending with missing marks, no fabricated profitable outcomes',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    const early=await cycle(env,date(decision+60_000),[]);
    assert.equal(early.journalCount,0);
    assert.equal(early.unmaturedHorizons.length,6);
    assert.equal(early.canAuthorizeLive,false);
    const mid=await cycle(env,date(decision+900_000+5000),[]);
    assert.equal(mid.journalCount,0);
    assert.ok(mid.overdueMarks.some(x=>x.includes('15m:WAITING_FOR_MARK')));
    const late=await cycle(env,date(decision+900_000+90000),[]);
    assert.ok(late.overdueMarks.some(x=>x.includes('15m:OVERDUE')));
    await assert.rejects(()=>env.journal.verifyReadback(),/EMPTY_NOT_COMMISSIONED/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('real-source-shaped marks grade all six horizons once on disk, cost-aware and replay-safe',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    const now=date(decision+periods['7d']+12000);
    const result=await cycle(env,now,marks);
    assert.equal(result.journalCount,6);
    assert.equal(result.insertedGrades,6);
    assert.equal(result.unmaturedHorizons.length,0);
    assert.equal(result.overdueMarks.length,0);
    const evidence=await (new MoneyLocalForwardJournal(env.journal.filePath)).verifyReadback();
    assert.equal(evidence.count,6);
    const grades=await env.journal.list();
    assert.equal(new Set(grades.map(g=>g.horizon)).size,6);
    assert.ok(grades.every(g=>!g.canExecute&&g.netReturnBps<g.grossReturnBps));
    const replay=await cycle(env,now,marks);
    assert.equal(replay.insertedGrades,0);
    assert.equal(replay.previouslyGraded,6);
    assert.equal(replay.journalTailHash,result.journalTailHash);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('bad provider receipt, synthetic quote and future received quote are denied',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    const now=date(decision+periods['15m']+9000);
    await assert.rejects(()=>cycle(env,now,[marks[0]!],[{...receipt,origin:'SYNTHETIC_FIXTURE'}]),
      /PROVIDER_ENTITLEMENT_UNVERIFIED/);
    await assert.rejects(()=>cycle(env,now,[marks[0]!],[]),/QUOTE_UNENTITLED/);
    await assert.rejects(()=>cycle(env,now,[{...marks[0]!,receivedAt:date(decision+periods['7d'])}]),
      /FUTURE_OR_UNAVAILABLE_QUOTE/);
    assert.equal((await env.journal.list()).length,0);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('an early future observation is not used to backfill an already overdue mark',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    const later={...marks[0]!,quoteId:'late',observedAt:date(decision+periods['15m']+60000),
      availableAt:date(decision+periods['15m']+61000),receivedAt:date(decision+periods['15m']+62000)};
    const run=await cycle(env,date(decision+periods['15m']+70000),[later]);
    assert.equal(run.insertedGrades,0);
    assert.ok(run.overdueMarks.some(x=>x.includes('15m:OVERDUE')));
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('tampered and partial prediction journal are rejected before any grades',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    const original=await readFile(env.queue.path,'utf8');
    await writeFile(env.queue.path,original.replace('LONG_BIAS','SHORT_BIAS'));
    await assert.rejects(()=>env.queue.list(),/HASH_OR_ID_INVALID/);
    await writeFile(env.queue.path,original.trimEnd());
    await assert.rejects(()=>env.queue.list(),/PARTIAL_WRITE/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
test('invalid policy and source with valid-looking but no independent operator are rejected',async()=>{
  const env=await setup();
  try{
    await env.queue.register(prediction);
    await assert.rejects(()=>cycle(env,date(decision+periods['15m']+10000),[marks[0]!],
      [{...receipt,checkedByIndependentOperator:false}]),/PROVIDER_ENTITLEMENT_UNVERIFIED/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});
