import {describe,expect,it} from 'vitest';
import {GamingResumeRegistry,projectGamingLibraryCard,selectGamingRuntimePath} from './gaming-product-fabric.js';

describe('G19/G20 gaming product and runtime fabric',()=>{
  it('projects a unified library card without leaking runtime implementation details',()=>{
    expect(projectGamingLibraryCard({
      game:{id:'g1',title:'Game',platform:'pc',contentUri:'native://g1',installed:true},
      runtimeIds:['native-pc','moonlight-remote'],hasSave:true,achievementReadAvailable:true,recentSessionAtMs:100,
    })).toMatchObject({gameId:'g1',installed:true,hasSave:true,runtimeIds:['native-pc','moonlight-remote']});
  });

  it('selects the shortest measured viable direct/offline path',()=>{
    const decision=selectGamingRuntimePath([
      {id:'phone-relay',runtimeId:'moonlight',execution:'phone',display:'tv',available:true,direct:false,offline:false,hops:2,networkLatencyMs:12,inputLatencyMs:8,measured:true},
      {id:'homebase-tv',runtimeId:'libretro-wasm',execution:'homebase',display:'tv',available:true,direct:true,offline:true,hops:0,networkLatencyMs:0,inputLatencyMs:5,measured:true},
    ],{maxNetworkLatencyMs:50,maxInputLatencyMs:20,requireMeasured:true,preferOffline:true,preferDirect:true});
    expect(decision.selected.id).toBe('homebase-tv');
  });

  it('persists a resume pointer independently of one runtime session',()=>{
    const registry=new GamingResumeRegistry();
    registry.save({gameId:'g1',runtimeId:'emulatorjs-browser',saveId:'s1',destination:'phone',controllerProfileId:'gamesir-x5-lite'});
    expect(registry.get('g1')).toMatchObject({runtimeId:'emulatorjs-browser',saveId:'s1'});
  });
});
