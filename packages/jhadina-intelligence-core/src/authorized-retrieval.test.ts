import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizedRetrievalPipeline } from './authorized-retrieval.js';
import type { RetrievalCandidate } from './hybrid-retrieval.js';

const candidate=(id:string):RetrievalCandidate=>({evidenceId:id,sourceKind:'memory',sourceId:id,channel:'lexical',summary:'secret-'+id,score:.5,observedAt:'2026-01-01T00:00:00Z',provenance:['p']});
const query={taskId:'t',text:'q',limit:10};
const principal={actorId:'u1',tenantId:'tenant1'};

test('authorization occurs before reranker sees candidate content',async()=>{
 let seen:string[]=[];
 const pipeline=new AuthorizedRetrievalPipeline(
  {async authorize(r){return r.evidenceId==='private'?'deny':'allow'}},
  {async rerank({candidates}){seen=candidates.map(c=>c.evidenceId);return candidates}},
 );
 const out=await pipeline.process({principal,query,candidates:[candidate('public'),candidate('private')]});
 assert.deepEqual(seen,['public']);
 assert.deepEqual(out.candidates.map(c=>c.evidenceId),['public']);
 assert.deepEqual(out.deniedEvidenceIds,['private']);
});

test('fails closed when actor identity is absent',async()=>{
 const pipeline=new AuthorizedRetrievalPipeline({async authorize(){return'allow'}});
 await assert.rejects(()=>pipeline.process({principal:{actorId:''},query,candidates:[candidate('x')]}),/RETRIEVAL_ACTOR_REQUIRED/);
});

test('reranker cannot inject an unauthorized candidate',async()=>{
 const injected=candidate('injected');
 const pipeline=new AuthorizedRetrievalPipeline(
  {async authorize(){return'allow'}},
  {async rerank({candidates}){return[...candidates,injected]}},
 );
 await assert.rejects(()=>pipeline.process({principal,query,candidates:[candidate('ok')]}),/RERANKER_UNAUTHORIZED_CANDIDATE/);
});

test('reranker cannot duplicate candidates',async()=>{
 const pipeline=new AuthorizedRetrievalPipeline(
  {async authorize(){return'allow'}},
  {async rerank({candidates}){return[candidates[0],candidates[0]]}},
 );
 await assert.rejects(()=>pipeline.process({principal,query,candidates:[candidate('ok')]}),/RERANKER_DUPLICATE_CANDIDATE/);
});

test('denied contradictory evidence is removed by authorization, not belief filtering',async()=>{
 const yes=candidate('yes'), no=candidate('no');
 const pipeline=new AuthorizedRetrievalPipeline({async authorize(r){return r.evidenceId==='yes'?'allow':'deny'}});
 const out=await pipeline.process({principal,query,candidates:[yes,no]});
 assert.deepEqual(out.candidates.map(c=>c.evidenceId),['yes']);
 assert.deepEqual(out.deniedEvidenceIds,['no']);
});
