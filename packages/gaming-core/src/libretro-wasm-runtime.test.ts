import {describe,expect,it,vi} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {
  LibretroWasmCoreRegistry,
  UniversalLibretroWasmRuntimeDriver,
  type LibretroWasmHost,
} from './libretro-wasm-runtime.js';

const approvedAudit={
  sourceId:'retroemu',
  provenanceVerified:true,
  licenseReviewed:true,
  maintenanceReviewed:true,
  inputReviewed:true,
  saveReviewed:true,
  firmwareRequirementsReviewed:true,
  securityReviewed:true,
  explicitUserApproval:true,
} as const;

const host=(bios=new Set<string>()):LibretroWasmHost=>({
  hasCore:async()=>true,
  hasBios:async id=>bios.has(id),
  launch:async()=>({sessionId:'wasm-1',flushSaves:async()=>{},stop:async()=>{}}),
});

describe('G16-EMU.2 UniversalLibretroWasmRuntimeDriver',()=>{
  it('resolves mainstream systems through one managed runtime',async()=>{
    const registry=new LibretroWasmCoreRegistry();
    expect(registry.resolve({id:'nes',title:'NES',platform:'nes',contentUri:'library://roms/game.nes'})?.coreId).toBe('fceumm');
    expect(registry.resolve({id:'gb',title:'GB',platform:'gameboy',contentUri:'library://roms/game.gb'})?.coreId).toBe('gambatte');
    expect(registry.resolve({id:'ps1',title:'PS1',platform:'ps1',contentUri:'library://roms/game.chd'})?.coreId).toBe('pcsx-rearmed');
    expect(registry.resolve({id:'n64',title:'N64',platform:'unknown',contentUri:'library://roms/game.z64',metadata:{emulationSystem:'n64'}})?.coreId).toBe('parallel-n64');
  });

  it('requires the G16-EMU.1 source audit and user approval before launch eligibility',async()=>{
    const game={id:'g1',title:'Game',platform:'nes' as const,contentUri:'library://roms/game.nes'};
    const content={canResolve:async()=>true};
    const denied=new UniversalLibretroWasmRuntimeDriver(host(),content,new LibretroWasmCoreRegistry(),undefined,{...approvedAudit,explicitUserApproval:false});
    const allowed=new UniversalLibretroWasmRuntimeDriver(host(),content,new LibretroWasmCoreRegistry(),undefined,approvedAudit);
    expect(await denied.canStart(game)).toBe(false);
    expect(await allowed.canStart(game)).toBe(true);
  });

  it('does not download missing BIOS and blocks systems whose required user-provided firmware is absent',async()=>{
    const game={id:'pcecd',title:'CD Game',platform:'unknown' as const,contentUri:'library://roms/game.cue',metadata:{emulationSystem:'pc-engine-cd'}};
    const content={canResolve:async()=>true};
    const denied=new UniversalLibretroWasmRuntimeDriver(host(),content,new LibretroWasmCoreRegistry(),undefined,approvedAudit);
    expect(await denied.canStart(game)).toBe(false);
    await expect(denied.start(game,{})).rejects.toThrow('Required BIOS/system ROM is unavailable');

    const allowed=new UniversalLibretroWasmRuntimeDriver(host(new Set(['syscard3.pce'])),content,new LibretroWasmCoreRegistry(),undefined,approvedAudit);
    expect(await allowed.canStart(game)).toBe(true);
  });

  it('runs through the existing unified session lifecycle and flushes saves before teardown',async()=>{
    const library=new InMemoryGameLibrary();
    await library.save({id:'g1',title:'Game',platform:'snes',contentUri:'library://roms/game.sfc'});
    const flushSaves=vi.fn(async()=>{});
    const stop=vi.fn(async()=>{});
    const runtimeHost:LibretroWasmHost={
      hasCore:async()=>true,
      hasBios:async()=>true,
      launch:async input=>{
        expect(input.core.coreId).toBe('snes9x');
        expect(input.saveId).toBe('save:g1');
        return{sessionId:'snes-1',flushSaves,stop};
      },
    };
    const driver=new UniversalLibretroWasmRuntimeDriver(runtimeHost,{canResolve:async()=>true},new LibretroWasmCoreRegistry(),undefined,approvedAudit);
    const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
    const session=await sessions.start({gameId:'g1',context:{saveId:'save:g1'},nowMs:100});
    expect(session).toMatchObject({status:'running',runtimeId:'libretro-wasm',runtimeKind:'emulator'});
    expect(session.resources).toContain('runtime:libretro:snes-1');
    const ended=await sessions.stop(session.sessionId,110);
    expect(ended.resources).toEqual([]);
    expect(flushSaves).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('refuses ambiguous extension-only core selection',()=>{
    const registry=new LibretroWasmCoreRegistry();
    expect(registry.resolve({id:'ambiguous',title:'Disc',platform:'unknown',contentUri:'library://roms/game.chd'})).toBeUndefined();
  });
});
