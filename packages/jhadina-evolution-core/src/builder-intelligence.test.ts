import{describe,it}from'node:test';import assert from'node:assert/strict';import{architectureOptions,builder715Drill,captureExperience,detectDrift,detectPattern,efficiencyScore,governLearning,intelligenceReport,learnRepair,optimizePlan,rankReuse,similarity,suggestTests,toHippocampus,updateBelief,type BuildExperience}from'./builder-intelligence.js';
const exp=(id:string,outcome:BuildExperience['outcome']='success',tests=['t']):BuildExperience=>({id,intent:'build website',contextTags:['website','nextjs'],planRef:'plan',implementationRefs:['impl'],testRefs:tests,repairRefs:[],deploymentRefs:[],outcome,evidenceRefs:[`e:${id}`]});
describe('BUILDER.7.1-7.15',()=>{
it('7.1 requires evidence for build experience',()=>assert.equal(captureExperience(exp('a')).id,'a'));
it('7.2 routes learning through Hippocampus without direct mutation',()=>assert.equal(toHippocampus(exp('a')).directMutationAllowed,false));
it('7.3 detects evidence-backed patterns',()=>assert.equal(detectPattern('p','architecture',[exp('a'),exp('b','failure')]).evidenceRefs.length,2));
it('7.4 updates Bayesian build belief',()=>assert.equal(updateBelief(detectPattern('p','reuse',[exp('a')])).mean,2/3));
it('7.5 retrieves contextually similar builds',()=>assert.equal(similarity(['website','nextjs'],[exp('a')])[0]!.score,1));
it('7.6 ranks only evidenced/provenanced reuse',()=>assert.deepEqual(rankReuse([{id:'x',compatibility:.9,evidenceRefs:['e'],provenanceRef:'p'},{id:'bad',compatibility:1,evidenceRefs:[],provenanceRef:''}]).map(x=>x.id),['x']));
it('7.7 proposes architecture alternatives without authority',()=>assert.equal(architectureOptions(true,['e'])[0]!.strategy,'reuse_existing'));
it('7.8 suggests tests from change evidence',()=>assert.ok(suggestTests(['database','ui','security'],['e']).length>=3));
it('7.9 repair learning requires verification',()=>assert.throws(()=>learnRepair({symptom:'x',rootCause:'y',repairRef:'r',verificationRef:'',recurrence:0})));
it('7.10 scores avoidable build waste',()=>assert.ok(efficiencyScore({buildId:'b',durationMs:1,toolCalls:10,failedAttempts:1,duplicateWork:1})<1));
it('7.11 detects architectural drift',()=>assert.equal(detectDrift(['packages/second-memory'])[0]!.kind,'duplicate_memory'));
it('7.12 optimized plan carries reuse tests and drift',()=>assert.equal(optimizePlan(['a'],[{id:'c',compatibility:1,evidenceRefs:['e'],provenanceRef:'p'}],suggestTests(['ui'],['e']),[]).reusedIds[0],'c'));
it('7.13 confidence never grants authority',()=>{const d=governLearning(detectPattern('p','repair',[exp('a'),exp('b')]));assert.equal(d.authorityGranted,false);assert.equal(d.protectedMutationAllowed,false)});
it('7.14 intelligence report is evidence linked',()=>assert.ok(intelligenceReport([detectPattern('p','test',[exp('a')])],detectDrift(['alternate-policy']),['ci pending']).evidenceRefs.length>=2));
it('7.15 learning drill improves retrieval while rejecting dangerous historical authority',()=>{const dangerous=detectPattern('danger','repair',[exp('a'),exp('b')]);const r=builder715Drill([exp('a'),exp('b'),exp('c','success',['t','regression'])],dangerous);assert.equal(r.retrievalUsed,true);assert.equal(r.planImproved,true);assert.equal(r.dangerousPatternRejected,true);assert.equal(r.authorityUnchanged,true)});
});
