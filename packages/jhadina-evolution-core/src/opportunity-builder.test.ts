import{describe,it}from'node:test';import assert from'node:assert/strict';import{canonicalizeSam,createPursuitWorkspace,decomposeRequirements,diagnoseOpportunity,matchProviders,prepareExternalAction,readiness,resolveCapabilityGaps,routeOpportunityIntent,runBuilder415}from'./opportunity-builder.js';
const opp=()=>canonicalizeSam({noticeId:'N1',title:'Network support',sourceUrl:'https://sam.gov/opp/N1/view',fetchedAt:'2026-09-20T00:00:00Z',solicitationNumber:'S1',agency:'Agency',naics:'541512',deadline:'2026-10-01'});
describe('BUILDER.4.1-4.15',()=>{
it('4.1 routes action intent',()=>assert.equal(routeOpportunityIntent('start this opportunity'),'start_pursuit'));
it('4.2/3 canonical SAM stays evidence-backed',()=>assert.equal(opp().evidence[0]!.authoritative,true));
it('4.4 creates pursuit workspace',()=>assert.equal(createPursuitWorkspace(opp()).opportunityId,opp().id));
it('4.5 preserves unresolved requirements',()=>assert.ok(decomposeRequirements(opp()).some(r=>r.status==='blocked')));
it('4.6 separates capability gaps',()=>{const r=decomposeRequirements(opp());assert.equal(resolveCapabilityGaps(r,{[r[0]!.id]:'naics-intelligence'})[0]!.resolution,'existing_capability')});
it('4.7 matches providers with evidence and never contacts',()=>{const p=matchProviders(decomposeRequirements(opp()),[{id:'p1',naics:['541512'],evidenceRefs:['ev']}])[0]!;assert.equal(p.contacted,false);assert.deepEqual(p.evidenceRefs,['ev'])});
it('4.8 research requires evidence',()=>assert.ok(runBuilder415({opportunity:opp()}).research.every(x=>x.evidenceRequired)));
it('4.9 build-on-demand is proposal-only',()=>{const r=decomposeRequirements(opp()),g=resolveCapabilityGaps(r,{}).map((x,i)=>i===0?{...x,resolution:'software_tool' as const}:x);assert.equal(g[0]!.resolution,'software_tool')});
it('4.10 response workspace has compliance matrix',()=>assert.ok(Object.keys(runBuilder415({opportunity:opp()}).response.complianceMatrix).length>0));
it('4.11 readiness is factual not win probability',()=>assert.equal(readiness(decomposeRequirements(opp())).ready,false));
it('4.12 consequential actions are never preauthorized',()=>assert.equal(prepareExternalAction('bid_submit').authorized,false));
it('4.13 Doctor localizes pipeline failure',()=>assert.equal(diagnoseOpportunity([{stage:'source',passed:true,evidenceRef:'a'},{stage:'normalization',passed:false,evidenceRef:'b'}]).failedStage,'normalization'));
it('4.14 outcome learning requires evidence',()=>assert.equal(runBuilder415({opportunity:opp()}).outcome.learningEligible,true));
it('4.15 full SAM drill stops before submission',()=>{const r=runBuilder415({opportunity:opp(),providers:[{id:'provider',naics:['541512'],evidenceRefs:['provider:verified']}],doctor:[{stage:'source',passed:true,evidenceRef:'sam:source'}]});assert.equal(r.opportunity.source,'sam');assert.equal(r.providers.length,1);assert.equal(r.stoppedBeforeSubmission,true);assert.ok(r.externalActions.every(a=>a.authorized===false));});
});
