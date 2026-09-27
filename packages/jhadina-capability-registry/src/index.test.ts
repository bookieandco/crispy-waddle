import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityRegistry,
  buildSubsystemRuntimeProjection,
  hydrateCapabilityRuntimeStatuses,
  persistCapabilityRuntimeStatus,
  type CapabilityRuntimeStatus,
  type CapabilityRuntimeStatusRepository,
} from './index.js';

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
      evidence:[{id:'live-1',source:'homebase-worker',observedAt:'2026-09-26T00:00:01Z',kind:'live-runtime',summary:'real render completed'}],
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


describe('Subsystem runtime projection',()=>{
  it('stays unknown when registered capabilities lack live status',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'tv.play',description:'play media',risk:'external',version:1,subsystemId:'tv'});
    const projection=buildSubsystemRuntimeProjection(registry,'tv');
    assert.equal(projection.state,'unknown');
    assert.deepEqual(projection.unknownCapabilities,['tv.play']);
  });

  it('fails the aggregate closed when one capability is blocked',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'sam.read',description:'read notices',risk:'read',version:1,subsystemId:'sam'});
    registry.register({name:'sam.refresh',description:'refresh notices',risk:'external',version:1,subsystemId:'sam'});
    registry.setRuntimeStatus({
      capabilityName:'sam.read',state:'ready',updatedAt:'2026-09-27T00:00:00Z',
      evidence:[{id:'live-read',source:'prod',observedAt:'2026-09-27T00:00:00Z',kind:'live-runtime',summary:'read succeeded'}],
    });
    registry.setRuntimeStatus({
      capabilityName:'sam.refresh',state:'blocked',reason:'scheduler unavailable',updatedAt:'2026-09-27T00:00:00Z',evidence:[],
    });
    const projection=buildSubsystemRuntimeProjection(registry,'sam');
    assert.equal(projection.state,'blocked');
  });

  it('expires stale evidence instead of reporting ready forever',()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'render',risk:'external',version:1,subsystemId:'director'});
    registry.setRuntimeStatus({
      capabilityName:'director.render',state:'ready',updatedAt:'2026-09-27T00:00:00Z',
      evidence:[{id:'live-1',source:'worker',observedAt:'2026-09-27T00:00:00Z',kind:'live-runtime',summary:'rendered',expiresAt:'2026-09-27T00:10:00Z'}],
    });
    const projection=buildSubsystemRuntimeProjection(registry,'director','2026-09-27T00:11:00Z');
    assert.equal(projection.state,'unknown');
    assert.equal(projection.capabilities[0]?.reason,'runtime evidence expired');
  });
});


describe('Capability runtime persistence',()=>{
  class MemoryStatusRepository implements CapabilityRuntimeStatusRepository {
    readonly statuses=new Map<string,CapabilityRuntimeStatus>();
    failSave=false;
    async get(name:string){return this.statuses.get(name);}
    async list(){return [...this.statuses.values()];}
    async save(status:CapabilityRuntimeStatus){
      if(this.failSave)throw new Error('PERSISTENCE_DOWN');
      this.statuses.set(status.capabilityName,status);
    }
  }

  const ready:CapabilityRuntimeStatus={
    capabilityName:'director.render',state:'ready',updatedAt:'2026-09-27T00:00:01Z',
    evidence:[{id:'live-1',source:'worker',observedAt:'2026-09-27T00:00:01Z',kind:'live-runtime',summary:'real render completed'}],
  };

  it('persists only after canonical READY evidence validation',async()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render media',risk:'external',version:1,subsystemId:'director'});
    const repository=new MemoryStatusRepository();
    await persistCapabilityRuntimeStatus(registry,repository,ready);
    assert.equal(repository.statuses.get('director.render')?.subsystemId,'director');
    assert.equal(registry.runtimeState('director.render'),'ready');
  });

  it('does not mutate in-memory truth when durable persistence fails',async()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render media',risk:'external',version:1,subsystemId:'director'});
    const repository=new MemoryStatusRepository();
    repository.failSave=true;
    await assert.rejects(()=>persistCapabilityRuntimeStatus(registry,repository,ready),/PERSISTENCE_DOWN/);
    assert.equal(registry.runtimeState('director.render'),'unknown');
  });

  it('rehydrates persisted state through the same validation rules',async()=>{
    const registry=new CapabilityRegistry();
    registry.register({name:'director.render',description:'Render media',risk:'external',version:1,subsystemId:'director'});
    const repository=new MemoryStatusRepository();
    repository.statuses.set('director.render',ready);
    await hydrateCapabilityRuntimeStatuses(registry,repository);
    assert.equal(registry.runtimeState('director.render'),'ready');
  });
});
