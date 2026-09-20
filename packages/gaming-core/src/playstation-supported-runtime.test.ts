import {describe,expect,it,vi} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {
  G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE,
  PlayStationManagedRuntimeDriver,
  PlayStationPairingService,
  evaluatePlayStationAcceptance,
  type PlayStationCredentialRecord,
} from './playstation-supported-runtime.js';
import {DUALSENSE_HARDWARE_PROFILE,GAMESIR_X5_LITE_HARDWARE_PROFILE} from './playstation-controller-hardware-profile.js';

describe('G15 supported PlayStation runtime',()=>{
  it('stores only credential references after PIN pairing',async()=>{
    const records:PlayStationCredentialRecord[]=[];
    const service=new PlayStationPairingService(
      {get:async()=>undefined,put:async record=>{records.push(record);}},
      {pair:async()=>({secretRef:'vault://playstation/ps5-1'})},
    );
    const record=await service.pair({consoleId:'ps5-1',family:'ps5',name:'PS5',address:'192.0.2.2',powerState:'awake',discoveredAtMs:1},'12345678',2);
    expect(record.secretRef).toBe('vault://playstation/ps5-1');
    expect(JSON.stringify(records)).not.toContain('12345678');
  });

  it('launches a paired console through the unified G14 lifecycle and wakes rest mode',async()=>{
    const game={id:'ps5:g1',title:'PS5 Game',platform:'ps5' as const,contentUri:'console://ps5/g1',metadata:{playStationConsoleId:'ps5-1',remoteTitleId:'title-1'}};
    const library=new InMemoryGameLibrary();await library.save(game);
    const wake=vi.fn(async()=>{});
    const stop=vi.fn(async()=>{});
    const driver=new PlayStationManagedRuntimeDriver(
      {discover:async()=>[{consoleId:'ps5-1',family:'ps5',name:'PS5',address:'192.0.2.2',powerState:'rest',discoveredAtMs:1}]},
      {get:async()=>({consoleId:'ps5-1',secretRef:'vault://ps5-1',pairedAtMs:1}),put:async()=>{}},
      {wake,connect:async input=>{expect(input.credentialRef).toBe('vault://ps5-1');return{sessionId:'rp-1',stop};}},
    );
    const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
    const session=await sessions.start({gameId:game.id,nowMs:100});
    expect(session.runtimeId).toBe('playstation-remote-play');
    expect(wake).toHaveBeenCalledTimes(1);
    const ended=await sessions.stop(session.sessionId,110);
    expect(ended.resources).toEqual([]);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('accepts DualSense at full fidelity and X5 through generic-gamepad fallback',()=>{
    const routes=[{id:'phone',kind:'remote-display' as const,available:true,latencyMs:10,direct:true,supportsLowLatency:true}];
    const quality={rttMs:20,jitterMs:2,packetLossPercent:0,inputLatencyMs:10};
    const dualsense=evaluatePlayStationAcceptance({controller:DUALSENSE_HARDWARE_PROFILE,playClass:'action',quality,displayRoutes:routes});
    const x5=evaluatePlayStationAcceptance({controller:GAMESIR_X5_LITE_HARDWARE_PROFILE,playClass:'action',quality,displayRoutes:routes});
    expect(dualsense).toMatchObject({allowed:true,controller:{fallbackMode:'full-dualsense'}});
    expect(x5).toMatchObject({allowed:true,controller:{fallbackMode:'generic-gamepad'}});
  });

  it('freezes the G15j matrix around both controller paths',()=>{
    expect(G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE.map(test=>test.controllerProfileId)).toEqual(['dualsense','gamesir-x5-lite']);
    expect(G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE.every(test=>test.requiresDisconnectReconnect&&test.requiresLatencyDegradation&&test.requiresZeroResourceLeak)).toBe(true);
  });
});
