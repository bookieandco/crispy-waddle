import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import { GovernedEvidenceVerifier } from './governed-evidence-verifier.js';

const packet:ContextPacket={
 id:'ctx',purpose:'test',relevantMemories:[],patterns:[],
 personality:{version:1,traits:[],independentAssessmentRequired:false,updatedAt:'2026-10-17T00:00:00.000Z'},
 knowledge:[{id:'known',source:'canonical',summary:'trusted',observedAt:'2026-10-17T00:00:00.000Z'}],
 constraints:[],excludedContext:[],
};
const context:any={task:{id:'task',riskClass:'standard'},packet,evidenceIds:['known'],contextHash:'digest'};
const proposal:DecisionProposal={
 id:'proposal',contextId:'ctx',disposition:'PROCEED',recommendation:'test',
 rationale:'reason',evidence:[],uncertainty:[],alternatives:[],
};
test('binds an authorized evidence id to the modern ContextPacket',async()=>{
 const output=await new GovernedEvidenceVerifier().verify({
  ...proposal,evidence:[{id:'known',source:'forged',summary:'fake',observedAt:'2099-01-01T00:00:00.000Z'}],
 },context);
 assert.equal(output.evidence[0]?.source,'canonical');assert.equal(output.disposition,'PROCEED');
});
test('unknown evidence is removed and proposed PROCEED is downgraded to DEFER',async()=>{
 const output=await new GovernedEvidenceVerifier().verify({
  ...proposal,evidence:[{id:'invented',source:'fake',summary:'fake',observedAt:'2099-01-01T00:00:00.000Z'}],
 },context);
 assert.equal(output.disposition,'DEFER');assert.deepEqual(output.evidence,[]);
});
test('mismatched context ID fails closed before admission',async()=>{
 await assert.rejects(()=>new GovernedEvidenceVerifier().verify({...proposal,contextId:'wrong'},context),/CONTEXT_MISMATCH/);
});

test('a context-present but compilation-excluded evidence id is never admitted',async()=>{
 const excluded={...context,evidenceIds:[]};
 const output=await new GovernedEvidenceVerifier().verify({
  ...proposal,evidence:[{id:'known',source:'canonical',summary:'trusted',observedAt:'2026-10-17T00:00:00.000Z'}],
 },excluded);
 assert.equal(output.disposition,'DEFER');assert.deepEqual(output.evidence,[]);
});
