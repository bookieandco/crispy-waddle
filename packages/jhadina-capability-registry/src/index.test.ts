import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from './index.js';

describe('CapabilityRegistry', () => {
  it('registers and retrieves immutable capability definitions', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name:'overage.review', description:'Read-only review of a verified opportunity', risk:'read', version:1 });
    assert.equal(registry.has('overage.review'), true);
  });

  it('rejects duplicate registrations', () => {
    const registry = new CapabilityRegistry();
    const capability={name:'money.read',description:'Read account data',risk:'read' as const,version:1};
    registry.register(capability);
    assert.throws(()=>registry.register(capability),/already registered/);
  });

  it('does not make policy decisions', () => {
    const registry=new CapabilityRegistry();
    registry.register({name:'overage.submit_claim',description:'Submit a claim',risk:'external',version:1});
    assert.equal(registry.has('overage.submit_claim'),true);
  });

  it('registers subsystem diagnostics and computes dependent regression coverage', () => {
    const registry=new CapabilityRegistry();
    registry.register({name:'knowledge.read',description:'Read knowledge',risk:'read',version:1,subsystemId:'knowledge'});
    registry.register({name:'ask.answer',description:'Answer through Ask Jhadina',risk:'read',version:1,subsystemId:'ask-jhadina'});
    registry.registerSubsystem({
      subsystemId:'knowledge', capabilityIds:['knowledge.read'], dependencies:[], protectedPaths:['/policy'],
      diagnostics:{healthChecks:['knowledge:health'],targetedTests:['test:knowledge'],regressionTests:['test:knowledge:regression'],staticAnalysis:['type-check'],runtimeEvidence:['runtime-errors']},
      repair:{governed:true,executor:'jhadina-evolution-core',rollbackRequired:true,authorizationCapability:'evolution.propose'}, invariants:['evidence is not authority']
    });
    registry.registerSubsystem({
      subsystemId:'ask-jhadina', capabilityIds:['ask.answer'], dependencies:['knowledge'], protectedPaths:[],
      diagnostics:{healthChecks:['ask:health'],targetedTests:['test:ask'],regressionTests:[],staticAnalysis:['type-check'],runtimeEvidence:['runtime-errors']},
      repair:{governed:true,executor:'jhadina-evolution-core',rollbackRequired:true,authorizationCapability:'evolution.propose'}, invariants:[]
    });
    assert.deepEqual(registry.regressionCommandsFor('knowledge'),['test:knowledge:regression','test:ask']);
  });
});
