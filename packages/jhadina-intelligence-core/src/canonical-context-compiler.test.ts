import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket } from '@jhadina/core-spine';
import { CanonicalIntelligenceContextCompiler } from './canonical-context-compiler.js';

const packet=():ContextPacket=>({id:'ctx',purpose:'Ask',userGoal:'goal',relevantMemories:[],patterns:[],personality:{version:0,traits:[],independentAssessmentRequired:true,updatedAt:'1970-01-01T00:00:00.000Z'},knowledge:[],constraints:['deny:x'],excludedContext:[]});
const task:any={id:'t',purpose:'goal',modalities:['text'],requiredCapabilities:['reason'],riskClass:'standard',privacyClass:'internal'};
const candidate=(id:string,summary='x',sourceKind:any='knowledge')=>({evidenceId:id,sourceKind,sourceId:id,channel:'lexical' as const,summary,score:.8,observedAt:'2026-01-01T00:00:00Z',provenance:['p']});

test('augments canonical packet without mutating source packet',async()=>{
 const source=packet();
 const compiler=new CanonicalIntelligenceContextCompiler({augmentation:async()=>({candidates:[candidate('e1')]})});
 const out=await compiler.compile(task,source);
 assert.equal(source.knowledge.length,0); assert.deepEqual(out.packet.knowledge.map(x=>x.id),['e1']);
 assert.deepEqual(out.packet.constraints,['deny:x']);
});

test('routes retrieved memories to memory context and other evidence to knowledge',async()=>{
 const compiler=new CanonicalIntelligenceContextCompiler({augmentation:async()=>({candidates:[candidate('m','memory','memory'),candidate('k')]})});
 const out=await compiler.compile(task,packet());
 assert.deepEqual(out.packet.relevantMemories.map(x=>x.id),['m']);
 assert.deepEqual(out.packet.knowledge.map(x=>x.id),['k']);
});

test('deterministic budget excludes candidates that do not fit',async()=>{
 const compiler=new CanonicalIntelligenceContextCompiler({maxAugmentedChars:3,augmentation:async()=>({candidates:[candidate('a','abc'),candidate('b','d')]})});
 const out=await compiler.compile(task,packet());
 assert.deepEqual(out.evidenceIds,['a']);
});

test('context hash is stable for identical governed input',async()=>{
 const compiler=new CanonicalIntelligenceContextCompiler();
 const a=await compiler.compile(task,packet()); const b=await compiler.compile(task,packet());
 assert.equal(a.contextHash,b.contextHash); assert.equal(a.contextHash.length,64);
});

test('compiled context is immutable and evidence ids include canonical packet evidence',async()=>{
 const p=packet(); p.knowledge.push({id:'existing',source:'x',observedAt:'2026-01-01',summary:'s'});
 const out=await new CanonicalIntelligenceContextCompiler().compile(task,p);
 assert.deepEqual(out.evidenceIds,['existing']); assert.equal(Object.isFrozen(out.packet),true);
});
