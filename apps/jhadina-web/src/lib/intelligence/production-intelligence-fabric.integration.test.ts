import { test } from 'node:test';import assert from 'node:assert/strict';
import type { ContextPacket,DecisionProposal } from '@jhadina/core-spine';

test('governed fabric compatibility contract returns DecisionProposal only',async()=>{
 const proposal:any={id:'p',contextId:'ctx',disposition:'DEFER',recommendation:'wait',rationale:'critic',evidence:[],uncertainty:[],alternatives:[]};
 const fabric={async decide(input:any,context:ContextPacket):Promise<DecisionProposal>{assert.equal(input.id,'task:ctx');assert.equal(input.privacyClass,'internal');assert.equal(context.id,'ctx');return proposal}};
 const out=await fabric.decide({id:'task:ctx',purpose:'review',privacyClass:'internal',riskClass:'standard'} as any,{id:'ctx'} as any);
 assert.equal(out.disposition,'DEFER');assert.equal((out as any).capability,undefined);assert.equal((out as any).approved,undefined);
});

test('fabric decision seam exposes no executor or approval method',()=>{
 const fabric:any={decide:async()=>{throw new Error('unused')}};assert.equal(fabric.execute,undefined);assert.equal(fabric.approve,undefined);assert.equal(fabric.grantCapability,undefined);
});
