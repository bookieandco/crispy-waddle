import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';
import { CapabilityAwareModelRouter, NoEligibleModelError } from './capability-aware-model-router.js';
import { ModelRegistry } from './model-registry.js';
import type { ModelProvider } from './router.js';
import type { CompiledIntelligenceContext } from './intelligence-fabric.js';

const provider = (name: string): ModelProvider => ({ name, async propose(_c: ContextPacket): Promise<DecisionProposal> { throw new Error('not invoked'); } });
const packet = {} as ContextPacket;
const context = (task: any): CompiledIntelligenceContext => ({ task, packet, evidenceIds: [], contextHash: 'h' });
const model = (id: string, extra: any = {}) => ({
 id, provider: id, providerModelId: id, modalities: ['text'], capabilities: ['reason'],
 maxPrivacyClass: 'sensitive', contextWindowTokens: 100000, maxOutputTokens: 4096,
 costClass: 'low', latencyClass: 'fast', lifecycle: 'active', local: false, version: 1, ...extra
});

test('filters by capability, modality, privacy and context before ranking', async () => {
 const registry = new ModelRegistry({version:1, models:[
  model('good'), model('no-vision'), model('public-only',{maxPrivacyClass:'public'}),
  model('small',{contextWindowTokens:1000}), model('disabled',{lifecycle:'disabled'})
 ]});
 const bindings=['good','no-vision','public-only','small','disabled'].map(id=>({modelId:id,provider:provider(id)}));
 const router=new CapabilityAwareModelRouter({registry,providers:bindings,minimumContextWindowTokens:()=>5000});
 const task:any={id:'t',purpose:'x',modalities:['text'],requiredCapabilities:['reason'],riskClass:'standard',privacyClass:'internal',complexity:'moderate'};
 const route=await router.select(task,context(task));
 assert.equal(route.provider.name,'good');
});

test('simple work prefers lower cost and latency deterministically', async () => {
 const registry=new ModelRegistry({version:1,models:[model('fast'),model('expensive',{costClass:'high',latencyClass:'slow',maxOutputTokens:8192})]});
 const router=new CapabilityAwareModelRouter({registry,providers:[{modelId:'fast',provider:provider('fast')},{modelId:'expensive',provider:provider('expensive')}]});
 const task:any={id:'t',purpose:'x',modalities:['text'],requiredCapabilities:['reason'],riskClass:'low',privacyClass:'public',complexity:'simple'};
 assert.equal((await router.select(task,context(task))).provider.name,'fast');
});

test('builds a deterministic fallback chain from eligible bound models', async () => {
 const registry=new ModelRegistry({version:1,models:[model('a'),model('b',{costClass:'medium'})]});
 const router=new CapabilityAwareModelRouter({registry,providers:[{modelId:'a',provider:provider('a')},{modelId:'b',provider:provider('b')}]});
 const task:any={id:'t',purpose:'x',modalities:['text'],requiredCapabilities:['reason'],riskClass:'standard',privacyClass:'internal',complexity:'moderate'};
 const route=await router.select(task,context(task));
 assert.equal(route.provider.name,'a'); assert.deepEqual(route.fallbackProviders.map(p=>p.name),['b']);
});

test('fails closed when no registered bound model satisfies the task', async () => {
 const registry=new ModelRegistry({version:1,models:[model('text')]});
 const router=new CapabilityAwareModelRouter({registry,providers:[{modelId:'text',provider:provider('text')}]});
 const task:any={id:'t',purpose:'x',modalities:['vision'],requiredCapabilities:['reason'],riskClass:'standard',privacyClass:'internal',complexity:'moderate'};
 await assert.rejects(()=>router.select(task,context(task)),NoEligibleModelError);
});
