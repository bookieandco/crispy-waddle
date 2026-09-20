import {describe,expect,it} from 'vitest';
import {GamingApiService} from './gaming-api.js';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator,type ManagedGamingRuntimeDriver} from './gaming-session-orchestrator.js';

describe('GamingApiService',()=>{
  it('turns Play into one runtime/display/session decision',async()=>{
    const library=new InMemoryGameLibrary();
    await library.save({id:'g1',title:'Game',platform:'pc',contentUri:'native://game'});
    const driver:ManagedGamingRuntimeDriver={
      id:'native-pc',runtimeKind:'native',canStart:async()=>true,
      start:async()=>({runtimeSessionId:'p1',runtimeId:'native-pc',runtimeKind:'native',stop:async()=>{}}),
    };
    const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
    const api=new GamingApiService(library,sessions);
    const view=await api.play({
      gameId:'g1',
      playClass:'action',
      quality:{rttMs:10,jitterMs:1,packetLossPercent:0,inputLatencyMs:5},
      displayRoutes:[{id:'tv',kind:'homebase-tv',available:true,latencyMs:8,direct:true,supportsLowLatency:true}],
      nowMs:100,
    });
    expect(view.session).toMatchObject({status:'running',runtimeId:'native-pc',displayRouteId:'tv'});
    expect(view.session.resources).toContain('display:tv');
    expect((await api.libraryView()).map(game=>game.id)).toEqual(['g1']);
    const stopped=await api.stop(view.session.sessionId,110);
    expect(stopped.status).toBe('stopped');
    expect(stopped.resources).toEqual([]);
    expect(api.active()).toEqual([]);
  });
});
