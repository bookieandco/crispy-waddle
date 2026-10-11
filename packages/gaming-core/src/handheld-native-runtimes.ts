import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';

/**
 * Verified upstream code reference only. No emulator/BIOS/ROM binaries bundled.
 * Hades: GBA desktop SDL3/OpenGL, GPL-2.0-only.
 * PatBoy: classic Game Boy desktop SDL2/OpenGL, MIT; Win64 premake build.
 */
export interface NativeHandheldDefinition {
  id:'hades-gba'|'patboy-gb';
  repository:string;
  sourceCommit:string;
  licenseId:'GPL-2.0-only'|'MIT';
  gamePlatform:'gba'|'gameboy';
  romExtension:'.gba'|'.gb';
  nativeSystems:readonly ('windows'|'linux'|'macos')[];
  needsGbaBios:boolean;
}
export const NATIVE_HANDHELD_DEFINITIONS:readonly NativeHandheldDefinition[]=Object.freeze([
  Object.freeze({
    id:'hades-gba',repository:'hades-emu/Hades',
    sourceCommit:'e12e42d7c563db9c12092406b06ca015ba938f9f',
    licenseId:'GPL-2.0-only',gamePlatform:'gba',romExtension:'.gba',
    nativeSystems:['windows','linux','macos'] as const,needsGbaBios:true,
  }),
  Object.freeze({
    id:'patboy-gb',repository:'Jonazan2/PatBoy',
    sourceCommit:'2b411814e2e264ac7a5c999c80f70311e5da438d',
    licenseId:'MIT',gamePlatform:'gameboy',romExtension:'.gb',
    nativeSystems:['windows'] as const,needsGbaBios:false,
  }),
]);
export type NativeHandheldId=NativeHandheldDefinition['id'];
export interface NativeHandheldInstallation {
  runtimeId:NativeHandheldId;
  sourceCommit:string;
  licenseId:'GPL-2.0-only'|'MIT';
  platform:'windows'|'linux'|'macos';
  executableSha256:string;
  version:string;
  provenanceVerified:boolean;
  licenseReviewed:boolean;
  explicitOperatorApproval:boolean;
}
export interface TrustedNativeHandheldGame {
  gameId:string;
  platform:'gba'|'gameboy';
  romPath:string;
  romSha256:string;
  userProvided:boolean;
  bytesVerified:boolean;
  /** Required for Hades; must be a lawfully obtained local BIOS dump. */
  biosPath?:string;
  biosSha256?:string;
  biosVerified?:boolean;
}
export interface NativeHandheldSession {
  processId:string;
  stop():Promise<void>;
}
export interface NativeHandheldHost {
  /** Only the native host inventory may attest installation, never a phone request. */
  installation(runtimeId:NativeHandheldId):Promise<NativeHandheldInstallation|undefined>;
  /** Resolve approved game IDs into host-local, verified ROM paths. */
  approvedGame(runtimeId:NativeHandheldId,gameId:string):Promise<TrustedNativeHandheldGame|undefined>;
  /** Implement with an argument array, shell=false, and a confined host process. */
  launch(input:{
    runtimeId:NativeHandheldId;
    installation:NativeHandheldInstallation;
    game:TrustedNativeHandheldGame;
    argv:readonly string[];
    controllerProfileId?:string;
    saveId?:string;
  }):Promise<NativeHandheldSession>;
}
const HEX=/^[0-9a-f]{64}$/i;
function safeAbsolutePath(path:string):boolean{
  if(typeof path!=='string'||!path.trim()||/[\x00-\x1f]/.test(path))return false;
  if(!/^(?:\/[^/]|[A-Za-z]:[\\/][^\\/])/.test(path))return false;
  return !/[\\/]\.\.(?:[\\/]|$)/.test(path);
}
export class NativeHandheldEmulatorDriver implements ManagedGamingRuntimeDriver{
  readonly runtimeKind='emulator' as const;
  readonly id:NativeHandheldId;
  readonly definition:NativeHandheldDefinition;
  constructor(runtimeId:NativeHandheldId,private readonly host:NativeHandheldHost){
    const definition=NATIVE_HANDHELD_DEFINITIONS.find(item=>item.id===runtimeId);
    if(!definition)throw new Error('Unknown handheld native emulator');
    this.definition=definition;
    this.id=runtimeId;
  }
  async canStart(game:GameLibraryEntry):Promise<boolean>{
    if(game.platform!==this.definition.gamePlatform||!game.id.trim())return false;
    return !!(await this.prepare(game));
  }
  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    if(game.platform!==this.definition.gamePlatform)throw new Error('Wrong game platform for handheld emulator');
    const prepared=await this.prepare(game);
    if(!prepared)throw new Error('Native handheld emulator or game is not admitted');
    const {installation,approved}=prepared;
    const argv=this.id==='hades-gba'?['--bios',approved.biosPath!,approved.romPath]:[approved.romPath];
    const process=await this.host.launch({
      runtimeId:this.id,installation,game:approved,argv,
      controllerProfileId:context.controllerProfileId,saveId:context.saveId,
    });
    if(!process.processId||!process.processId.trim()){
      try{await process.stop();}catch{/* failed cleanup requires host watchdog */}
      throw new Error('Native handheld host returned no process identity');
    }
    return{
      runtimeSessionId:`handheld:${this.id}:${process.processId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      stop:()=>process.stop(),
    };
  }
  private async prepare(game:GameLibraryEntry):Promise<{
    installation:NativeHandheldInstallation;approved:TrustedNativeHandheldGame;
  }|undefined>{
    const d=this.definition;
    const installation=await this.host.installation(d.id);
    if(!installation
      ||installation.runtimeId!==d.id||installation.sourceCommit!==d.sourceCommit
      ||installation.licenseId!==d.licenseId
      ||!d.nativeSystems.includes(installation.platform)
      ||!HEX.test(installation.executableSha256)
      ||!installation.version.trim()
      ||!installation.provenanceVerified||!installation.licenseReviewed
      ||!installation.explicitOperatorApproval)return undefined;
    const approved=await this.host.approvedGame(d.id,game.id);
    if(!approved||approved.gameId!==game.id||approved.platform!==d.gamePlatform
      ||!approved.userProvided||!approved.bytesVerified
      ||!safeAbsolutePath(approved.romPath)
      ||!approved.romPath.toLowerCase().endsWith(d.romExtension)
      ||!HEX.test(approved.romSha256))return undefined;
    if(d.needsGbaBios&&(!approved.biosVerified||!safeAbsolutePath(approved.biosPath??'')
      ||!HEX.test(approved.biosSha256??'')))return undefined;
    return{installation,approved};
  }
}
