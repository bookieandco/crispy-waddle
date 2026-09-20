import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';
import {EmulatorSourceRegistry,type EmulatorCandidateAudit} from './emulator-source-registry.js';

export type EmulatorJsSystem=
  |'atari5200'|'vb'|'nds'|'arcade'|'nes'|'gb'|'coleco'
  |'segaMS'|'segaMD'|'segaGG'|'segaCD'|'sega32x'|'lynx'
  |'mame'|'ngp'|'pce'|'pcfx'|'psx'|'ws'|'gba'|'n64'
  |'3do'|'psp'|'atari7800'|'snes'|'atari2600'|'jaguar'
  |'segaSaturn'|'amiga'|'c64'|'c128'|'pet'|'plus4'|'vic20'
  |'dos'|'intv'|'3ds';

export interface EmulatorJsCoreDescriptor {
  system:EmulatorJsSystem;
  coreId:string;
  extensions:readonly string[];
  requiresThreads:boolean;
  requiresWebGL2:boolean;
  requiredBios:readonly string[];
}

const descriptor=(
  system:EmulatorJsSystem,
  coreId:string,
  extensions:readonly string[],
  options:{threads?:boolean;webgl2?:boolean;bios?:readonly string[]}={},
):EmulatorJsCoreDescriptor=>({
  system,
  coreId,
  extensions,
  requiresThreads:options.threads??false,
  requiresWebGL2:options.webgl2??false,
  requiredBios:options.bios??[],
});

export const PINNED_EMULATORJS_CORES:readonly EmulatorJsCoreDescriptor[]=Object.freeze([
  descriptor('nes','fceumm',['nes','fds','unf','unif']),
  descriptor('gb','gambatte',['gb','gbc']),
  descriptor('gba','mgba',['gba']),
  descriptor('snes','snes9x',['sfc','smc']),
  descriptor('n64','mupen64plus_next',['z64','n64','v64']),
  descriptor('psx','pcsx_rearmed',['cue','chd','pbp','bin','img','iso']),
  descriptor('nds','melonds',['nds']),
  descriptor('segaMD','genesis_plus_gx',['md','gen','smd']),
  descriptor('segaMS','genesis_plus_gx',['sms']),
  descriptor('segaGG','genesis_plus_gx',['gg']),
  descriptor('segaCD','genesis_plus_gx',['cue','chd'],{bios:['sega-cd-bios']}),
  descriptor('atari2600','stella2014',['a26']),
  descriptor('atari5200','a5200',['a52'],{bios:['atari5200-bios']}),
  descriptor('atari7800','prosystem',['a78']),
  descriptor('lynx','handy',['lnx']),
  descriptor('ngp','mednafen_ngp',['ngp','ngc']),
  descriptor('pce','mednafen_pce',['pce']),
  descriptor('ws','mednafen_wswan',['ws','wsc']),
  descriptor('coleco','gearcoleco',['col'],{bios:['colecovision-bios']}),
  descriptor('psp','ppsspp',['iso','cso','pbp'],{threads:true,webgl2:true}),
  descriptor('dos','dosbox_pure',['zip','dosz'],{threads:true}),
  descriptor('3ds','azahar',['3ds','cci','cxi'],{threads:true,webgl2:true}),
]);

export interface BrowserRuntimeEnvironment {
  gamepad:boolean;
  indexedDb:boolean;
  webgl2:boolean;
  crossOriginIsolated:boolean;
  wasmThreads:boolean;
}

export interface EmulatorJsAssetManifest {
  version:string;
  dataPath:string;
  localAssetsProvisioned:boolean;
  cdnFallbackDisabled:boolean;
  pinnedCoreIds:readonly string[];
}

export interface BrowserGameContent {
  uri:string;
  locality:'app'|'device'|'memory';
}

export interface BrowserGameContentProvider {
  resolve(contentUri:string):Promise<BrowserGameContent|undefined>;
}

export interface BrowserFirmwareProvider {
  has(firmwareId:string):Promise<boolean>;
  localUri(firmwareId:string):Promise<string|undefined>;
}

export interface EmulatorJsBrowserSession {
  sessionId:string;
  pause?():Promise<void>;
  resume?():Promise<void>;
  flushSaves():Promise<void>;
  stop():Promise<void>;
}

export interface EmulatorJsBrowserHost {
  environment():Promise<BrowserRuntimeEnvironment>;
  assetManifest():Promise<EmulatorJsAssetManifest>;
  launch(input:{
    gameId:string;
    system:EmulatorJsSystem;
    coreId:string;
    gameUri:string;
    biosUris:Readonly<Record<string,string>>;
    dataPath:string;
    version:string;
    controllerProfileId?:string;
    saveId?:string;
    disableExternalNetwork:true;
    disableCdnFallback:true;
    persistentSaves:boolean;
  }):Promise<EmulatorJsBrowserSession>;
}

export class EmulatorJsCoreRegistry {
  constructor(private readonly cores:readonly EmulatorJsCoreDescriptor[]=PINNED_EMULATORJS_CORES){}

  resolve(game:GameLibraryEntry):EmulatorJsCoreDescriptor|undefined{
    const requested=game.metadata?.emulatorJsSystem;
    if(typeof requested==='string'){
      return this.cores.find(candidate=>candidate.system===requested);
    }
    const platformMap:Partial<Record<GameLibraryEntry['platform'],EmulatorJsSystem>>={
      gameboy:'gb',
      gba:'gba',
      nes:'nes',
      snes:'snes',
      genesis:'segaMD',
      ps1:'psx',
    };
    const platform=platformMap[game.platform];
    if(platform)return this.cores.find(candidate=>candidate.system===platform);

    const extension=this.extension(game.contentUri);
    const matches=this.cores.filter(candidate=>candidate.extensions.includes(extension));
    return matches.length===1?matches[0]:undefined;
  }

  list(system?:EmulatorJsSystem):readonly EmulatorJsCoreDescriptor[]{
    return this.cores.filter(candidate=>!system||candidate.system===system);
  }

  private extension(contentUri:string):string{
    const withoutQuery=contentUri.split(/[?#]/,1)[0]??contentUri;
    const filename=withoutQuery.split('/').at(-1)??'';
    return filename.includes('.')?(filename.split('.').at(-1)??'').toLowerCase():'';
  }
}

export class EmulatorJsManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='emulatorjs-browser';
  readonly runtimeKind='emulator' as const;

  constructor(
    private readonly host:EmulatorJsBrowserHost,
    private readonly content:BrowserGameContentProvider,
    private readonly firmware:BrowserFirmwareProvider,
    private readonly cores=new EmulatorJsCoreRegistry(),
    private readonly sources=new EmulatorSourceRegistry(),
    private readonly audit:EmulatorCandidateAudit={
      sourceId:'emulatorjs',
      provenanceVerified:true,
      licenseReviewed:true,
      maintenanceReviewed:true,
      inputReviewed:true,
      saveReviewed:true,
      firmwareRequirementsReviewed:true,
      securityReviewed:true,
      explicitUserApproval:false,
    },
  ){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    if(!this.sources.promote(this.audit).allowed)return false;
    const core=this.cores.resolve(game);
    if(!core)return false;
    const [environment,manifest,resolved]=await Promise.all([
      this.host.environment(),
      this.host.assetManifest(),
      this.content.resolve(game.contentUri),
    ]);
    if(!resolved)return false;
    if(!this.manifestAdmitted(manifest,core))return false;
    if(!this.environmentSupports(environment,core))return false;
    return this.requiredFirmwareAvailable(core);
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const promotion=this.sources.promote(this.audit);
    if(!promotion.allowed)throw new Error(`EmulatorJS source not admitted: ${promotion.reason}`);

    const core=this.cores.resolve(game);
    if(!core)throw new Error(`No unambiguous EmulatorJS core for game: ${game.id}`);

    const [environment,manifest,resolved]=await Promise.all([
      this.host.environment(),
      this.host.assetManifest(),
      this.content.resolve(game.contentUri),
    ]);
    if(!resolved)throw new Error('Game content is not available from an approved browser content provider');
    if(!this.manifestAdmitted(manifest,core))throw new Error('EmulatorJS self-hosted assets/core are not admitted');
    if(!this.environmentSupports(environment,core))throw new Error('Browser environment does not satisfy EmulatorJS core requirements');

    const biosUris:Record<string,string>={};
    for(const firmwareId of core.requiredBios){
      const uri=await this.firmware.localUri(firmwareId);
      if(!uri)throw new Error(`Required browser emulator BIOS/system ROM is unavailable: ${firmwareId}`);
      biosUris[firmwareId]=uri;
    }

    const session=await this.host.launch({
      gameId:game.id,
      system:core.system,
      coreId:core.coreId,
      gameUri:resolved.uri,
      biosUris,
      dataPath:manifest.dataPath,
      version:manifest.version,
      controllerProfileId:context.controllerProfileId,
      saveId:context.saveId,
      disableExternalNetwork:true,
      disableCdnFallback:true,
      persistentSaves:environment.indexedDb,
    });
    if(!session.sessionId.trim())throw new Error('EmulatorJS host returned an empty session id');

    return{
      runtimeSessionId:`emulatorjs:${session.sessionId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      pause:session.pause?()=>session.pause!():undefined,
      resume:session.resume?()=>session.resume!():undefined,
      stop:async()=>{
        await session.flushSaves();
        await session.stop();
      },
    };
  }

  private manifestAdmitted(manifest:EmulatorJsAssetManifest,core:EmulatorJsCoreDescriptor):boolean{
    return Boolean(
      manifest.version.trim()&&
      manifest.dataPath.trim()&&
      manifest.localAssetsProvisioned&&
      manifest.cdnFallbackDisabled&&
      manifest.pinnedCoreIds.includes(core.coreId)
    );
  }

  private environmentSupports(environment:BrowserRuntimeEnvironment,core:EmulatorJsCoreDescriptor):boolean{
    if(!environment.gamepad)return false;
    if(core.requiresWebGL2&&!environment.webgl2)return false;
    if(core.requiresThreads&&(!environment.wasmThreads||!environment.crossOriginIsolated))return false;
    return true;
  }

  private async requiredFirmwareAvailable(core:EmulatorJsCoreDescriptor):Promise<boolean>{
    for(const firmwareId of core.requiredBios){
      if(!(await this.firmware.has(firmwareId)))return false;
    }
    return true;
  }
}
