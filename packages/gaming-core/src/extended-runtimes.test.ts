import {describe,expect,it,vi} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {G17_G18_ACCEPTANCE,HighEndNativeEmulatorDriver,XboxManagedRuntimeDriver} from './extended-runtimes.js';

describe('G17 Xbox and G18 high-end emulator runtimes',()=>{
  it('keeps Xbox credentials as secret references and supports home/cloud session classes',async()=>{
    const stop=vi.fn(async()=>{});
    const driver=new XboxManagedRuntimeDriver(
      {discover:async()=>[{consoleId:'x1',name:'Xbox',generation:'xbox-series',available:true}]},
      {getSecretRef:async()=> 'vault://xbox/account-1'},
      {
        connectHome:async input=>{expect(input.credentialRef).toBe('vault://xbox/account-1');return{sessionId:'home-1',stop};},
        connectCloud:async()=>({sessionId:'cloud-1',stop}),
      },
    );
    const home={id:'x-home',title:'Xbox Home',platform:'cloud' as const,contentUri:'xbox://home',metadata:{xboxAccountId:'a1',xboxConsoleId:'x1',xboxMode:'home'}};
    const cloud={id:'x-cloud',title:'Xbox Cloud',platform:'cloud' as const,contentUri:'xbox://cloud',metadata:{xboxAccountId:'a1',xboxTitleId:'t1',xboxMode:'cloud'}};
    expect(await driver.canStart(home)).toBe(true);
    expect(await driver.canStart(cloud)).toBe(true);
    expect((await driver.start(home,{})).runtimeSessionId).toBe('xbox:home-1');
    expect((await driver.start(cloud,{})).runtimeSessionId).toBe('xbox:cloud-1');
  });

  it('admits only verified installed high-end emulator binaries and uses G14 lifecycle',async()=>{
    const library=new InMemoryGameLibrary();
    await library.save({id:'ps2:g1',title:'PS2 Game',platform:'unknown',contentUri:'library://g1.iso',metadata:{highEndSystem:'ps2'}});
    const stop=vi.fn(async()=>{});
    const driver=new HighEndNativeEmulatorDriver(
      {get:async()=>({executableId:'pcsx2',version:'2.0',executableHash:'sha256:abc',provenanceVerified:true,licenseReviewed:true})},
      {launch:async input=>{expect(input.definition.runtimeId).toBe('pcsx2');return{processId:'p1',stop};}},
    );
    const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
    const session=await sessions.start({gameId:'ps2:g1',nowMs:100});
    expect(session.runtimeId).toBe('high-end-native-emulator');
    expect((await sessions.stop(session.sessionId,110)).resources).toEqual([]);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('freezes the G17/G18 acceptance scope',()=>{
    expect(G17_G18_ACCEPTANCE.xbox).toContain('cloud-stream');
    expect(G17_G18_ACCEPTANCE.nativeEmulators).toEqual(['dolphin','pcsx2','rpcs3','ppsspp','xemu']);
  });
});
