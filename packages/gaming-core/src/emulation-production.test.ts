import {describe,expect,it} from 'vitest';
import {
  BrowserAssetProvisioner,
  buildPortableGamePackage,
  UniversalEmulatorSaveBridge,
  DEFAULT_EMULATOR_CONTROLLER_MAPPING,
  assertGameplayHotkeysSeparated,
  selectEmulatorPerformanceCandidate,
  GameContentIdentityService,
  UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX,
} from './emulation-production.js';

describe('G16-EMU.4-.10 production emulation fabric',()=>{
  it('certifies only complete local browser assets with CDN fallback disabled',()=>{
    const provisioner=new BrowserAssetProvisioner();
    expect(()=>provisioner.certify({
      version:'4.3.0-pre',dataPath:'/vendor/emulatorjs/',loaderPresent:true,stylesheetPresent:true,
      coreIds:['fceumm','snes9x'],cdnFallbackDisabled:true,
    },['fceumm'])).not.toThrow();
    expect(()=>provisioner.certify({
      version:'4.3.0-pre',dataPath:'/vendor/emulatorjs/',loaderPresent:true,stylesheetPresent:true,
      coreIds:['fceumm'],cdnFallbackDisabled:false,
    },['fceumm'])).toThrow('CDN fallback');
  });

  it('builds offline packages only from user-provided content provenance',()=>{
    expect(buildPortableGamePackage({
      gameId:'g1',contentHash:'abcdef0123456789',contentSource:'user-provided',
      runtimeId:'emulatorjs-browser',runtimeVersion:'4.3.0-pre',coreId:'fceumm',
      offlineAssets:['loader.js','emulator.js','fceumm.wasm'],
    })).toMatchObject({format:'jhadina-portable-game-v1',packageId:'portable:g1:abcdef0123456789:4.3.0-pre'});
  });

  it('normalizes emulator saves and refuses irreconcilable equal-revision conflicts',()=>{
    const bridge=new UniversalEmulatorSaveBridge();
    const a={gameId:'g1',ownerId:'u1',runtimeId:'browser',kind:'state' as const,contentHash:'a',revision:2,updatedAtMs:100,payloadUri:'save://a'};
    const b={...a,runtimeId:'wasm',contentHash:'b',payloadUri:'save://b'};
    expect(bridge.normalize(a)).toMatchObject({gameId:'g1',ownerId:'u1',kind:'state',revision:2});
    expect(()=>bridge.resolveConflict(a,b)).toThrow('user resolution');
  });

  it('keeps emulator hotkeys separate from gameplay mappings',()=>{
    expect(()=>assertGameplayHotkeysSeparated(DEFAULT_EMULATOR_CONTROLLER_MAPPING)).not.toThrow();
  });

  it('selects measured compatible execution while avoiding expensive phone thermals',()=>{
    const selected=selectEmulatorPerformanceCandidate([
      {runtimeId:'phone',compatible:true,measured:true,frameTimeMs:10,audioLatencyMs:10,inputLatencyMs:5,thermalCost:9,batteryCost:8,location:'phone'},
      {runtimeId:'homebase',compatible:true,measured:true,frameTimeMs:12,audioLatencyMs:12,inputLatencyMs:7,thermalCost:2,batteryCost:1,location:'homebase'},
    ],{maxFrameTimeMs:17,maxAudioLatencyMs:50,maxInputLatencyMs:20,preferHomebaseWhenThermalCostAtLeast:8});
    expect(selected.runtimeId).toBe('homebase');
  });

  it('uses content digests for duplicate identity rather than filenames alone',()=>{
    const service=new GameContentIdentityService();
    const first=service.identify({title:'Game',platform:'nes',byteLength:123,contentDigest:'ABCDEF',source:'user-selected'});
    const duplicate=service.identify({title:'Renamed Game',platform:'nes',byteLength:123,contentDigest:'abcdef',source:'user-selected'});
    expect(service.deduplicate([first,duplicate])).toHaveLength(1);
    expect(first.canonicalId).toBe('game:nes:abcdef');
  });

  it('defines representative G16-EMU.10 browser, WASM, BIOS and offline acceptance',()=>{
    expect(UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX.some(test=>test.biosRequired)).toBe(true);
    expect(new Set(UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX.map(test=>test.runtime))).toEqual(
      new Set(['libretro-wasm','emulatorjs-browser','portable-offline']),
    );
    expect(UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX.every(test=>test.controllerRequired&&test.mustRestoreSave)).toBe(true);
  });
});
