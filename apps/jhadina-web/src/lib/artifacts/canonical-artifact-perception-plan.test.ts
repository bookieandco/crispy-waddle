import {describe,expect,it} from 'vitest';
import {planCanonicalArtifactPerception} from './canonical-artifact-perception-plan';
import type {ArtifactRuntimeState} from './artifact-extraction-runtime';
const base:ArtifactRuntimeState={id:'a1',name:'file.pdf',mimeType:'application/pdf',sizeBytes:100,
 status:'clean',contextReady:false,extractionStatus:'pending'};
const plan=(artifact:ArtifactRuntimeState,owner='alice')=>planCanonicalArtifactPerception({
 verifiedOwnerId:'alice',artifactOwnerId:owner,artifact,
});
describe('historical JLLM perception compatibility without new persistence',()=>{
 it('refuses other owners before planning',()=>expect(()=>plan(base,'bob')).toThrow(/OWNER_DENIED/));
 it('refuses quarantine, rejected, and needs review files even when extracted refs claim ready',()=>{
  for(const status of ['quarantine','rejected','needs_review'] as const){
   expect(plan({...base,status,contextReady:true,extractionStatus:'ready'}).state).toBe('blocked');
  }
 });
 it('only points clean unextracted document to current extractor review',()=>{
  expect(plan(base)).toMatchObject({state:'review_existing_extractor',canonicalSource:'jhadina_artifacts'});
 });
 it('admits clean context ready without new worker, bucket or SQL',()=>{
  expect(plan({...base,contextReady:true,extractionStatus:'ready'})).toMatchObject({
   state:'admitted',modality:'document'
  });
 });
 it('unsupported formats fail closed',()=>expect(plan({...base,mimeType:'application/x-sh',extractionStatus:'unsupported'}).state).toBe('blocked'));
});
