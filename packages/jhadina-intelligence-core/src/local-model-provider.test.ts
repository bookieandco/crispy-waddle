import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket } from '@jhadina/core-spine';
import { LocalModelProviderAdapter, localModelEntry } from './local-model-provider.js';
import { ModelRegistry } from './model-registry.js';
import { RegistryBackedModelProvider } from './provider-adapter.js';
const packet = { id: 'ctx', purpose: 'test', relevantMemories: [], patterns: [],
 personality: {version:1,traits:[],independentAssessmentRequired:false,updatedAt:'2026-10-17T00:00:00Z'},
 knowledge:[],constraints:[],excludedContext:[] } as ContextPacket;
const configured=()=>localModelEntry({id:'local.test',providerModelId:'mock',version:1,contextWindowTokens:8192,maxOutputTokens:1024,enabled:true});
test('local entry is disabled until explicitly enabled and is not part of default registry',()=>{
 const entry=localModelEntry({id:'local.test',providerModelId:'mock',version:1,contextWindowTokens:8192,maxOutputTokens:1024});
 assert.equal(entry.lifecycle,'disabled'); assert.equal(entry.maxPrivacyClass,'restricted'); assert.equal(entry.local,true);
 const registry=new ModelRegistry({version:1,models:[entry]});
 assert.deepEqual(registry.eligible({modalities:['text'],capabilities:['reason'],privacyClass:'restricted'}),[]);
});
test('isolated fake transport produces schema-validated proposal without tool authority',async()=>{
 let calls=0;
 const adapter=new LocalModelProviderAdapter({async generate(i){calls++;assert.equal(i.model,'mock');
  return{text:JSON.stringify({disposition:'DEFER',recommendation:'none',rationale:'unverified',
   evidence:[],uncertainty:[],alternatives:[]}),inputTokens:2,outputTokens:3};}});
 const registry=new ModelRegistry({version:1,models:[configured()]});
 const wrapper=new RegistryBackedModelProvider({modelId:'local.test',registry,adapter});
 const output=await wrapper.propose(packet);
 assert.equal(output.disposition,'DEFER'); assert.equal(calls,1);
 assert.equal((adapter as any).execute,undefined);assert.equal((adapter as any).writeMemory,undefined);
});
test('wrong provider and disabled model do not call transport',async()=>{
 let called=false;const adapter=new LocalModelProviderAdapter({async generate(){called=true;return{text:'{}'}}});
 await assert.rejects(()=>adapter.invoke({model:{...configured(),provider:'anthropic'},context:packet}),/MODEL_REQUIRED/);
 await assert.rejects(()=>adapter.invoke({model:{...configured(),lifecycle:'disabled'},context:packet}),/DISABLED/);
 assert.equal(called,false);
});
test('malformed transport output fails rather than fabricating a proposal',async()=>{
 const adapter=new LocalModelProviderAdapter({async generate(){return{text:'{}'}}});
 await assert.rejects(()=>adapter.invoke({model:configured(),context:packet}));
});
