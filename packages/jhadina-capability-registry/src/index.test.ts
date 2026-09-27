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


describe('Capability runtime state', () => {
  it('defaults registered capabilities to unknown until runtime evidence exists', () => {
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render media',risk:'external',version:1,subsystemId:'director'});
    assert.equal(registry.runtimeState('director.render'),'unknown');
  });

  it('requires live-runtime evidence before claiming ready', () => {
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render media',risk:'external',version:1,subsystemId:'director'});
    assert.throws(()=>registry.setRuntimeStatus({
      capabilityName:'director.render',subsystemId:'director',state:'ready',updatedAt:'2026-09-26T00:00:00Z',
      evidence:[{id:'src-1',source:'ci',observedAt:'2026-09-26T00:00:00Z',kind:'source',summary:'tests pass'}],
    }),/LIVE_RUNTIME_EVIDENCE/);
    registry.setRuntimeStatus({
      capabilityName:'director.render',subsystemId:'director',state:'ready',updatedAt:'2026-09-26T00:00:01Z',
      evidence:[{id:'live-1',source:'homebase-worker',observedAt:'2026-09-26T00:00:01Z',expiresAt:'2026-09-26T00:05:01Z',kind:'live-runtime',summary:'real render completed'}],
    });
    assert.equal(registry.runtimeState('director.render'),'ready');
  });

  it('preserves paper-only and degraded states without implying execution authority', () => {
    const registry=new CapabilityRegistry();
    registry.register({name:'shark.trade',description:'Trade candidate execution surface',risk:'financial',version:1,subsystemId:'shark'});
    registry.setRuntimeStatus({
      capabilityName:'shark.trade',state:'paper-only',updatedAt:'2026-09-26T00:00:00Z',
      evidence:[{id:'paper-1',source:'paper-runner',observedAt:'2026-09-26T00:00:00Z',kind:'infrastructure',summary:'paper adapter available'}],
    });
    assert.equal(registry.getRuntimeStatus('shark.trade')?.state,'paper-only');
  });
});


describe('Capability runtime freshness',()=>{
  it('degrades READY after live-runtime evidence expires',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'tv.playback',description:'Play media',risk:'external',version:1,subsystemId:'tv'});
    registry.setRuntimeStatus({
      capabilityName:'tv.playback',state:'ready',updatedAt:'2026-09-26T00:00:01Z',
      evidence:[{
        id:'live-tv-1',source:'device-smoke',observedAt:'2026-09-26T00:00:00Z',expiresAt:'2026-09-26T00:10:00Z',
        kind:'live-runtime',summary:'real playback succeeded',
      }],
    });
    assert.equal(registry.effectiveRuntimeStatus('tv.playback','2026-09-26T00:09:59Z').state,'ready');
    const stale=registry.effectiveRuntimeStatus('tv.playback','2026-09-26T00:10:00Z');
    assert.equal(stale.state,'degraded');
    assert.equal(stale.reason,'LIVE_RUNTIME_EVIDENCE_EXPIRED');
    assert.equal(stale.staleEvidence.length,1);
  });

  it('refuses READY when the live evidence has no explicit fresh expiry',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render',risk:'external',version:1});
    assert.throws(()=>registry.setRuntimeStatus({
      capabilityName:'director.render',state:'ready',updatedAt:'2026-09-26T00:00:01Z',
      evidence:[{id:'live',source:'worker',observedAt:'2026-09-26T00:00:00Z',kind:'live-runtime',summary:'worked once'}],
    }),/FRESH_EXPIRING_LIVE_RUNTIME_EVIDENCE/);
  });

  it('keeps explicit blocked and disabled states fail-closed even after evidence expiry',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'sam.submit',description:'Submit opportunity response',risk:'external',version:1});
    registry.setRuntimeStatus({
      capabilityName:'sam.submit',state:'blocked',reason:'credential missing',updatedAt:'2026-09-26T00:00:01Z',
      evidence:[{id:'block-1',source:'runtime',observedAt:'2026-09-26T00:00:00Z',expiresAt:'2026-09-26T00:01:00Z',kind:'infrastructure',summary:'credential absent'}],
    });
    const evaluated=registry.effectiveRuntimeStatus('sam.submit','2026-09-26T01:00:00Z');
    assert.equal(evaluated.state,'blocked');
    assert.equal(evaluated.staleEvidence.length,1);
  });

  it('returns UNKNOWN for registered capabilities with no runtime status',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'sports.nhl.watch',description:'Watch NHL evidence',risk:'read',version:1,subsystemId:'sports'});
    const evaluated=registry.effectiveRuntimeStatus('sports.nhl.watch','2026-09-26T00:00:00Z');
    assert.equal(evaluated.state,'unknown');
    assert.equal(evaluated.reason,'NO_RUNTIME_STATUS_RECORDED');
  });

  it('rejects malformed or future-dated evidence',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'x.read',description:'x',risk:'read',version:1});
    assert.throws(()=>registry.setRuntimeStatus({
      capabilityName:'x.read',state:'degraded',updatedAt:'2026-09-26T00:00:00Z',
      evidence:[{id:'e',source:'runtime',observedAt:'2026-09-26T00:00:01Z',kind:'infrastructure',summary:'late'}],
    }),/EVIDENCE_FROM_FUTURE/);
  });
});
