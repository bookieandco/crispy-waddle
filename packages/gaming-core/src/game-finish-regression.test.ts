import {describe,expect,it,vi} from 'vitest';
import {GamingApiService} from './gaming-api.js';
import {InMemoryGameLibrary} from './game-library.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator,type ManagedGamingRuntimeDriver} from './gaming-session-orchestrator.js';
import {GamingSessionMonitor} from './session-telemetry.js';

async function fixture(invalidIdentity=false){
  const library=new InMemoryGameLibrary();
  await library.save({id:'g',title:'Game',platform:'pc',contentUri:'native://g'});
  const stop=vi.fn(async()=>{});
  const launch=vi.fn(async()=>({runtimeSessionId:'runtime-1',runtimeId:invalidIdentity?'wrong':'pc',runtimeKind:'native' as const,stop}));
  const driver:ManagedGamingRuntimeDriver={id:'pc',runtimeKind:'native',canStart:async()=>true,start:launch};
  const registry=new UnifiedGamingSessionRegistry();
  const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],registry,new GamingSessionMonitor());
  const request={gameId:'g',playClass:'action' as const,quality:{rttMs:5,jitterMs:0,packetLossPercent:0,inputLatencyMs:5},displayRoutes:[{id:'phone',kind:'phone-cast' as const,available:true,latencyMs:5,direct:true,supportsLowLatency:true}]};
  return{library,registry,sessions,stop,launch,request};
}

describe('GAME-FINISH launch and resource repairs',()=>{
  it('denies a missing grant before a runtime starts',async()=>{
    const f=await fixture();
    const api=new GamingApiService(f.library,f.sessions,{authorize:()=>({allowed:false,reason:'not-authorized'})});
    await expect(api.play(f.request)).rejects.toThrow(/authorization denied/);
    expect(f.launch).not.toHaveBeenCalled();
    expect(f.sessions.active()).toHaveLength(0);
  });
  it('rejects a provider with no actual grant',async()=>{
    const f=await fixture();
    const api=new GamingApiService(f.library,f.sessions,{authorize:async()=>undefined as never});
    await expect(api.play(f.request)).rejects.toThrow(/missing-grant/);
    expect(f.launch).not.toHaveBeenCalled();
  });
  it('rolls back a running runtime if display setup fails',async()=>{
    const f=await fixture();
    const api=new GamingApiService(f.library,f.sessions,{authorize:()=>({allowed:true,reason:'authorized'})});
    vi.spyOn(f.sessions,'setDisplayRoute').mockImplementation(()=>{throw new Error('display failed');});
    await expect(api.play(f.request)).rejects.toThrow('display failed');
    expect(f.stop).toHaveBeenCalledOnce();
    expect(f.sessions.active()).toHaveLength(0);
    expect(f.sessions.runtimeHandleCount()).toBe(0);
  });
  it('stops a returned runtime handle even when the driver lies about identity',async()=>{
    const f=await fixture(true);
    await expect(f.sessions.start({gameId:'g'})).rejects.toThrow(/inconsistent identity/);
    expect(f.stop).toHaveBeenCalledOnce();
    expect(f.sessions.runtimeHandleCount()).toBe(0);
    expect(f.sessions.active()).toHaveLength(0);
  });
  it('keeps failed stop handles for a later cleanup retry',async()=>{
    const f=await fixture();
    const view=await f.sessions.start({gameId:'g'});
    f.stop.mockRejectedValueOnce(new Error('process busy'));
    const failed=await f.sessions.stop(view.sessionId);
    expect(failed.status).toBe('failed');
    expect(f.sessions.runtimeHandleCount()).toBe(1);
    await f.sessions.stop(view.sessionId);
    expect(f.sessions.runtimeHandleCount()).toBe(0);
    expect(f.sessions.get(view.sessionId)?.resources).toEqual([]);
  });
});
