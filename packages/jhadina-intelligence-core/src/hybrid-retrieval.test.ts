import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HybridRetrievalBridge, type RetrievalCandidate } from './hybrid-retrieval.js';

const c=(id:string,score:number,extra:Partial<RetrievalCandidate>={}):RetrievalCandidate=>({
 evidenceId:id,sourceKind:'knowledge',sourceId:id,channel:'lexical',summary:id,score,
 observedAt:'2026-01-01T00:00:00Z',provenance:['source:'+id],...extra
});

test('merges heterogeneous sources deterministically and deduplicates by immutable evidence id',async()=>{
 const bridge=new HybridRetrievalBridge([
  {name:'lex',async retrieve(){return[c('e1',.4),c('e2',.8)]}},
  {name:'vec',async retrieve(){return[c('e1',.9,{channel:'vector'}),c('e3',.7)]}},
 ]);
 const out=await bridge.retrieve({taskId:'t',text:'query',limit:10});
 assert.deepEqual(out.candidates.map(x=>x.evidenceId),['e1','e2','e3']);
 assert.equal(out.candidates[0].channel,'vector');
});

test('preserves contradictory evidence rather than suppressing disagreement',async()=>{
 const bridge=new HybridRetrievalBridge([{name:'k',async retrieve(){return[
  c('yes',.9,{contradictionGroup:'claim-1'}),c('no',.85,{contradictionGroup:'claim-1'})
 ]}}]);
 const out=await bridge.retrieve({taskId:'t',text:'q',limit:10});
 assert.deepEqual(out.candidates.map(x=>x.evidenceId),['yes','no']);
});

test('isolates source failure while retaining successful evidence',async()=>{
 const bridge=new HybridRetrievalBridge([
  {name:'bad',async retrieve(){throw new Error('down')}},
  {name:'good',async retrieve(){return[c('e1',.8)]}},
 ]);
 const out=await bridge.retrieve({taskId:'t',text:'q',limit:5});
 assert.deepEqual(out.candidates.map(x=>x.evidenceId),['e1']);
 assert.equal(out.sourceFailures.length,1); assert.equal(out.sourceFailures[0].source,'bad');
});

test('rejects evidence without provenance',async()=>{
 const bridge=new HybridRetrievalBridge([{name:'bad',async retrieve(){return[c('e1',.8,{provenance:[]})]}}]);
 await assert.rejects(()=>bridge.retrieve({taskId:'t',text:'q',limit:5}),/RETRIEVAL_PROVENANCE_REQUIRED/);
});

test('does not expose mutation or truth-admission methods',()=>{
 const bridge:any=new HybridRetrievalBridge([]);
 assert.equal(bridge.write,undefined); assert.equal(bridge.approve,undefined); assert.equal(bridge.admitTruth,undefined);
});
