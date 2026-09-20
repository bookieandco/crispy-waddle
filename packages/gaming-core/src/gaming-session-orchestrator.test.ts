import {describe,expect,it} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator,type ManagedGamingRuntimeDriver,type GamingControllerLifecycle} from './gaming-session-orchestrator.js';

describe('UnifiedGamingSessionOrchestrator',()=>{
  it('owns runtime and controller resources through deterministic teardown',async()=>{
    const library=new InMemoryGameLibrary();
    await library.save({id:'g1',title:'Test',platform:'pc',contentUri:'native://test'});
    let stopped=0;const driver:ManagedGamingRuntimeDriver={
      id:'native-test',runtimeKind:'native',canStart:async()=>true,
      start:async()=>({runtimeSessionId:'p1',runtimeId:'native-test',runtimeKind:'native',stop:async()=>{stopped++;}}),
    };
    const events:string[]=[];
    const controller:GamingControllerLifecycle={
      bind:(s,d)=>{events.push(`bind:${s}:${d}`);},
      disconnect:(s,d)=>{events.push(`disconnect:${s}:${d}`);},
      unbind:(s,d)=>{events.push(`unbind:${s}:${d}`);},
    };
    const orchestrator=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor(),controller);
    const session=await orchestrator.start({gameId:'g1',controllerDeviceId:'pad1',nowMs:100});
    expect(session.status).toBe('running');
    expect(session.resources).toEqual(['controller:pad1','runtime:p1']);
    const stoppedSession=await orchestrator.stop(session.sessionId,110);
    expect(stoppedSession.status).toBe('stopped');
    expect(stoppedSession.resources).toEqual([]);
    expect(stopped).toBe(1);
    expect(orchestrator.runtimeHandleCount()).toBe(0);
    expect(events.map(value=>value.split(':')[0])).toEqual(['bind','disconnect','unbind']);
  });
});
