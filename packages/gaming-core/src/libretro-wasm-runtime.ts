import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';
import {EmulatorSourceRegistry,type EmulatorCandidateAudit} from './emulator-source-registry.js';

export type LibretroSystemId=
  |'nes'|'snes'|'gameboy'|'gameboy-color'|'gba'|'n64'
  |'genesis'|'master-system'|'game-gear'
  |'atari-2600'|'atari-5200'|'atari-7800'|'atari-800'|'atari-lynx'
  |'pc-engine'|'pc-engine-cd'
  |'neo-geo-pocket'|'wonder-swan'
  |'colecovision'|'vectrex'|'zx-spectrum'|'msx'
  |'playstation';

export interface LibretroBiosRequirement {
  id:string;
  required:boolean;
}

export interface LibretroCoreDescriptor {
  coreId:string;
  system:LibretroSystemId;
  extensions:readonly string[];
  sourceId:'retroemu';
  buildPolicy:'pinned-reviewed';
  bios:readonly LibretroBiosRequirement[];
  capabilities:readonly ('controller-input'|'save-state'|'battery-save'|'disk-control')[];
}

const core=(
  coreId:string,
  system:LibretroSystemId,
  extensions:readonly string[],
  bios:readonly LibretroBiosRequirement[]=[],
  extra:readonly ('disk-control')[]=[],
):LibretroCoreDescriptor=>({
  coreId,
  system,
  extensions,
  sourceId:'retroemu',
  buildPolicy:'pinned-reviewed',
  bios,
  capabilities:['controller-input','save-state','battery-save',...extra],
});

export const PINNED_LIBRETRO_WASM_CORES:readonly LibretroCoreDescriptor[]=Object.freeze([
  core('fceumm','nes',['nes','fds','unf','unif']),
  core('snes9x','snes',['sfc','smc']),
  core('gambatte','gameboy',['gb']),
  core('gambatte','gameboy-color',['gbc']),
  core('mgba','gba',['gba']),
  core('parallel-n64','n64',['z64','n64','v64']),
  core('genesis-plus-gx','genesis',['md','gen','smd','bin']),
  core('genesis-plus-gx','master-system',['sms']),
  core('genesis-plus-gx','game-gear',['gg']),
  core('stella2014','atari-2600',['a26']),
  core('atari800','atari-5200',['a52']),
  core('prosystem','atari-7800',['a78']),
  core('atari800','atari-800',['xex','atr','atx','bas','car','xfd']),
  core('handy','atari-lynx',['lnx']),
  core('beetle-pce-fast','pc-engine',['pce']),
  core('beetle-pce-fast','pc-engine-cd',['cue','ccd','chd'],[{id:'syscard3.pce',required:true}],['disk-control']),
  core('mednafen-ngp','neo-geo-pocket',['ngp','ngc']),
  core('mednafen-wswan','wonder-swan',['ws','wsc']),
  core('gearcoleco','colecovision',['col'],[{id:'colecovision-system-rom',required:true}]),
  core('vecx','vectrex',['vec']),
  core('fuse','zx-spectrum',['tzx','z80','sna']),
  core('fmsx','msx',['mx1','mx2','rom','dsk','cas']),
  core('pcsx-rearmed','playstation',['bin','cue','img','mdf','pbp','toc','cbn','m3u','ccd','chd','iso','exe'],[
    {id:'scph5501.bin',required:false},
  ],['disk-control']),
]);

export interface LibretroContentProvider {
  canResolve(contentUri:string):Promise<boolean>;
}

export interface LibretroWasmHostSession {
  sessionId:string;
  pause?():Promise<void>;
  resume?():Promise<void>;
  flushSaves?():Promise<void>;
  stop():Promise<void>;
}

export interface LibretroWasmHost {
  hasCore(coreId:string):Promise<boolean>;
  hasBios(biosId:string):Promise<boolean>;
  launch(input:{
    gameId:string;
    contentUri:string;
    core:LibretroCoreDescriptor;
    controllerProfileId?:string;
    saveId?:string;
    performanceProfileId?:string;
  }):Promise<LibretroWasmHostSession>;
}

export class LibretroWasmCoreRegistry {
  constructor(private readonly cores:readonly LibretroCoreDescriptor[]=PINNED_LIBRETRO_WASM_CORES){}

  resolve(game:GameLibraryEntry):LibretroCoreDescriptor|undefined{
    const requested=this.systemFromGame(game);
    if(requested)return this.cores.find(candidate=>candidate.system===requested);
    const extension=this.extension(game.contentUri);
    const matches=this.cores.filter(candidate=>candidate.extensions.includes(extension));
    return matches.length===1?matches[0]:undefined;
  }

  list(system?:LibretroSystemId):readonly LibretroCoreDescriptor[]{
    return this.cores.filter(candidate=>!system||candidate.system===system);
  }

  private systemFromGame(game:GameLibraryEntry):LibretroSystemId|undefined{
    const metadataSystem=game.metadata?.emulationSystem;
    if(typeof metadataSystem==='string'&&this.isSystem(metadataSystem))return metadataSystem;
    const platformMap:Partial<Record<GameLibraryEntry['platform'],LibretroSystemId>>={
      gameboy:'gameboy',
      gba:'gba',
      nes:'nes',
      snes:'snes',
      genesis:'genesis',
      ps1:'playstation',
    };
    return platformMap[game.platform];
  }

  private extension(contentUri:string):string{
    const withoutQuery=contentUri.split(/[?#]/,1)[0]??contentUri;
    const filename=withoutQuery.split('/').at(-1)??'';
    return filename.includes('.')?(filename.split('.').at(-1)??'').toLowerCase():'';
  }

  private isSystem(value:string):value is LibretroSystemId{
    return this.cores.some(candidate=>candidate.system===value);
  }
}

export class UniversalLibretroWasmRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='libretro-wasm';
  readonly runtimeKind='emulator' as const;

  constructor(
    private readonly host:LibretroWasmHost,
    private readonly content:LibretroContentProvider,
    private readonly coreRegistry=new LibretroWasmCoreRegistry(),
    private readonly sourceRegistry=new EmulatorSourceRegistry(),
    private readonly audit:EmulatorCandidateAudit={
      sourceId:'retroemu',
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
    if(!this.sourceRegistry.promote(this.audit).allowed)return false;
    const selected=this.coreRegistry.resolve(game);
    if(!selected)return false;
    if(!(await this.content.canResolve(game.contentUri)))return false;
    if(!(await this.host.hasCore(selected.coreId)))return false;
    return this.requiredBiosAvailable(selected);
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const promotion=this.sourceRegistry.promote(this.audit);
    if(!promotion.allowed)throw new Error(`Libretro runtime source not admitted: ${promotion.reason}`);
    const selected=this.coreRegistry.resolve(game);
    if(!selected)throw new Error(`No unambiguous Libretro core for game: ${game.id}`);
    if(!(await this.content.canResolve(game.contentUri)))throw new Error('Game content is not available from an approved local/content provider');
    if(!(await this.host.hasCore(selected.coreId)))throw new Error(`Libretro core is not installed: ${selected.coreId}`);
    if(!(await this.requiredBiosAvailable(selected)))throw new Error(`Required BIOS/system ROM is unavailable for ${selected.system}`);

    const session=await this.host.launch({
      gameId:game.id,
      contentUri:game.contentUri,
      core:selected,
      controllerProfileId:context.controllerProfileId,
      saveId:context.saveId,
      performanceProfileId:context.performanceProfileId,
    });
    if(!session.sessionId.trim())throw new Error('Libretro host returned an empty session id');

    return{
      runtimeSessionId:`libretro:${session.sessionId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      pause:session.pause?()=>session.pause!():undefined,
      resume:session.resume?()=>session.resume!():undefined,
      stop:async()=>{
        if(session.flushSaves)await session.flushSaves();
        await session.stop();
      },
    };
  }

  private async requiredBiosAvailable(core:LibretroCoreDescriptor):Promise<boolean>{
    for(const bios of core.bios){
      if(bios.required&&!(await this.host.hasBios(bios.id)))return false;
    }
    return true;
  }
}
