import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import { ModelRegistry } from './model-registry.js';
import { ProviderInvocationError, RegistryBackedModelProvider } from './provider-adapter.js';

const proposal = { id: 'p' } as DecisionProposal;
const context = { id: 'c' } as ContextPacket;
const registry = (extra:any={}) => new ModelRegistry({version:1,models:[{
 id:'m',provider:'test',providerModelId:'native',modalities:['text'],capabilities:['reason'],
 maxPrivacyClass:'sensitive',contextWindowTokens:1000,maxOutputTokens:100,
 costClass:'low',latencyClass:'fast',lifecycle:'active',local:false,version:1,...extra
}]});

test('normalizes provider metadata without changing the proposal contract', async()=>{
 const dates=[new Date('2026-01-01T00:00:00Z'),new Date('2026-01-01T00:00:00.125Z')];
 const seen:any[]=[];
 const p=new RegistryBackedModelProvider({modelId:'m',registry:registry(),adapter:{provider:'test',async invoke(){return{proposal,usage:{inputTokens:10,outputTokens:4},providerRequestId:'r1'}}},now:()=>dates.shift()!,onInvocation:m=>{seen.push(m)}});
 const out=await p.invoke(context);
 assert.equal(out.proposal,proposal); assert.equal(out.metadata.latencyMs,125);
 assert.equal(out.metadata.canonicalModelId,'m'); assert.equal(out.metadata.providerModelId,'native');
 assert.deepEqual(out.metadata.usage,{inputTokens:10,outputTokens:4}); assert.equal(seen.length,1);
});

test('rejects adapter/model provider mismatch at construction',()=>{
 assert.throws(()=>new RegistryBackedModelProvider({modelId:'m',registry:registry(),adapter:{provider:'other',async invoke(){return{proposal}}}}),/PROVIDER_ADAPTER_MISMATCH/);
});

test('fails closed for inactive models even if an adapter is bound',async()=>{
 const p=new RegistryBackedModelProvider({modelId:'m',registry:registry({lifecycle:'disabled'}),adapter:{provider:'test',async invoke(){return{proposal}}}});
 await assert.rejects(()=>p.propose(context),/PROVIDER_MODEL_NOT_ACTIVE/);
});

test('wraps provider-native failures with canonical model identity',async()=>{
 const p=new RegistryBackedModelProvider({modelId:'m',registry:registry(),adapter:{provider:'test',async invoke(){throw new Error('network')}}});
 await assert.rejects(()=>p.propose(context),(e:any)=>e instanceof ProviderInvocationError && e.canonicalModelId==='m');
});
