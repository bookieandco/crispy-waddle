import {describe,expect,it,vi} from 'vitest';
import {InMemoryGameLibrary} from './game-library.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {
  EmulatorJsCoreRegistry,
  EmulatorJsManagedRuntimeDriver,
  type BrowserRuntimeEnvironment,
  type EmulatorJsBrowserHost,
} from './emulatorjs-browser-runtime.js';

const approvedAudit={
  sourceId:'emulatorjs',
  provenanceVerified:true,
  licenseReviewed:true,
  maintenanceReviewed:true,
  inputReviewed:true,
  saveReviewed:true,
  firmwareRequirementsReviewed:true,
  securityReviewed:true,
  explicitUserApproval:true,
} as const;

const env:BrowserRuntimeEnvironment={
  gamepad:true,
  indexedDb:true,
  webgl2:true,
  crossOriginIsolated:true,
  wasmThreads:true,
};

function host(overrides:Partial<BrowserRuntimeEnvironment>={}):EmulatorJsBrowserHost{
  return{
    environment:async()=>({...env,...overrides}),
    assetManifest:async()=>({
      version:'4.3.0-pre',
      dataPath:'/vendor/emulatorjs/4.3.0-pre/data/',
      localAssetsProvisioned:true,
      cdnFallbackDisabled:true,
      pinnedCoreIds:['fceumm','gambatte','mgba','snes9x','mupen64plus_next','pcsx_rearmed','melonds','ppsspp','dosbox_pure','azahar','genesis_plus_gx','stella2014','a5200','prosystem','handy','mednafen_ngp','mednafen_pce','mednafen_wswan','gearcoleco'],
    }),
    launch:async()=>({sessionId:'browser-1',flushSaves:async()=>{},stop:async()=>{}}),
  };
}

const content={resolve:async(uri:string)=>({uri:`/content/${encodeURIComponent(uri)}`,locality:'app' as const})};
const firmware={
  has:async()=>true,
  localUri:async(id:string)=>`/firmware/${id}`,
};

describe('G16-EMU.3 EmulatorJsManagedRuntimeDriver',()=>{
  it('maps common library platforms to pinned browser cores',()=>{
    const cores=new EmulatorJsCoreRegistry();
    expect(cores.resolve({id:'nes',title:'NES',platform:'nes',contentUri:'library://game.nes'})?.coreId).toBe('fceumm');
    expect(cores.resolve({id:'gba',title:'GBA',platform:'gba',contentUri:'library://game.gba'})?.coreId).toBe('mgba');
    expect(cores.resolve({id:'ps1',title:'PS1',platform:'ps1',contentUri:'library://game.chd'})?.coreId).toBe('pcsx_rearmed');
  });

  it('requires self-hosted assets with CDN fallback disabled',async()=>{
    const badHost:EmulatorJsBrowserHost={
      ...host(),
      assetManifest:async()=>({
        version:'4.3.0-pre',
        dataPath:'https://cdn.emulatorjs.org/stable/data/',
        localAssetsProvisioned:false,
        cdnFallbackDisabled:false,
        pinnedCoreIds:['fceumm'],
      }),
    };
    const driver=new EmulatorJsManagedRuntimeDriver(badHost,content,firmware,new EmulatorJsCoreRegistry(),undefined,approvedAudit);
    expect(await driver.canStart({id:'g1',title:'NES',platform:'nes',contentUri:'library://game.nes'})).toBe(false);
  });

  it('enforces WebAssembly thread/cross-origin isolation requirements for threaded cores',async()=>{
    const driver=new EmulatorJsManagedRuntimeDriver(host({crossOriginIsolated:false}),content,firmware,new EmulatorJsCoreRegistry(),undefined,approvedAudit);
    const game={id:'psp',title:'PSP',platform:'unknown' as const,contentUri:'library://game.cso',metadata:{emulatorJsSystem:'psp'}};
    expect(await driver.canStart(game)).toBe(false);
    await expect(driver.start(game,{})).rejects.toThrow('Browser environment does not satisfy EmulatorJS core requirements');
  });

  it('does not acquire missing firmware and rejects the launch',async()=>{
    const missing={
      has:async()=>false,
      localUri:async()=>undefined,
    };
    const driver=new EmulatorJsManagedRuntimeDriver(host(),content,missing,new EmulatorJsCoreRegistry(),undefined,approvedAudit);
    const game={id:'segacd',title:'Sega CD',platform:'unknown' as const,contentUri:'library://game.cue',metadata:{emulatorJsSystem:'segaCD'}};
    expect(await driver.canStart(game)).toBe(false);
    await expect(driver.start(game,{})).rejects.toThrow('Required browser emulator BIOS/system ROM is unavailable');
  });

  it('runs in the G14 managed session lifecycle and flushes browser saves before teardown',async()=>{
    const library=new InMemoryGameLibrary();
    await library.save({id:'g1',title:'SNES',platform:'snes',contentUri:'library://roms/game.sfc'});
    const flushSaves=vi.fn(async()=>{});
    const stop=vi.fn(async()=>{});
    const browserHost:EmulatorJsBrowserHost={
      ...host(),
      launch:async input=>{
        expect(input).toMatchObject({
          system:'snes',
          coreId:'snes9x',
          disableExternalNetwork:true,
          disableCdnFallback:true,
          persistentSaves:true,
          saveId:'save:g1',
        });
        return{sessionId:'browser-snes',flushSaves,stop};
      },
    };
    const driver=new EmulatorJsManagedRuntimeDriver(browserHost,content,firmware,new EmulatorJsCoreRegistry(),undefined,approvedAudit);
    const sessions=new UnifiedGamingSessionOrchestrator(library,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
    const session=await sessions.start({gameId:'g1',context:{saveId:'save:g1'},nowMs:100});
    expect(session).toMatchObject({status:'running',runtimeId:'emulatorjs-browser',runtimeKind:'emulator'});
    expect(session.resources).toContain('runtime:emulatorjs:browser-snes');
    const ended=await sessions.stop(session.sessionId,110);
    expect(ended.resources).toEqual([]);
    expect(flushSaves).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('refuses ambiguous disc/container extensions unless system metadata disambiguates them',()=>{
    const cores=new EmulatorJsCoreRegistry();
    expect(cores.resolve({id:'ambiguous',title:'Disc',platform:'unknown',contentUri:'library://game.cue'})).toBeUndefined();
    expect(cores.resolve({id:'resolved',title:'Disc',platform:'unknown',contentUri:'library://game.cue',metadata:{emulatorJsSystem:'segaCD'}})?.coreId).toBe('genesis_plus_gx');
  });
});
