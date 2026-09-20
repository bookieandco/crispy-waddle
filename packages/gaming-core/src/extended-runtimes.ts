import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';

export const XBOX_STREAMING_REFERENCE=Object.freeze({
  repository:'unknownskl/greenlight',
  role:'xbox-home-and-cloud-streaming-reference',
});

export interface XboxConsole {
  consoleId:string;
  name:string;
  generation:'xbox-one'|'xbox-series';
  available:boolean;
}

export interface XboxConsoleDiscovery {
  discover():Promise<readonly XboxConsole[]>;
}

export interface XboxCredentialVault {
  getSecretRef(accountId:string):Promise<string|undefined>;
}

export interface XboxRemoteSession {
  sessionId:string;
  stop():Promise<void>;
}

export interface XboxStreamingHost {
  connectHome(input:{console:XboxConsole;credentialRef:string;controllerProfileId?:string}):Promise<XboxRemoteSession>;
  connectCloud(input:{titleId:string;credentialRef:string;controllerProfileId?:string}):Promise<XboxRemoteSession>;
}

export class XboxManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='xbox-streaming';
  readonly runtimeKind='console' as const;

  constructor(
    private readonly discovery:XboxConsoleDiscovery,
    private readonly credentials:XboxCredentialVault,
    private readonly host:XboxStreamingHost,
  ){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    const accountId=this.accountId(game);
    if(!accountId||!(await this.credentials.getSecretRef(accountId)))return false;
    const mode=game.metadata?.xboxMode;
    if(mode==='cloud')return typeof game.metadata?.xboxTitleId==='string';
    const consoleId=game.metadata?.xboxConsoleId;
    if(typeof consoleId!=='string')return false;
    return (await this.discovery.discover()).some(console=>console.consoleId===consoleId&&console.available);
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const accountId=this.accountId(game);
    if(!accountId)throw new Error('Xbox game is missing account identity');
    const credentialRef=await this.credentials.getSecretRef(accountId);
    if(!credentialRef)throw new Error('Xbox account is not authorized');
    let remote:XboxRemoteSession;
    if(game.metadata?.xboxMode==='cloud'){
      const titleId=game.metadata?.xboxTitleId;
      if(typeof titleId!=='string'||!titleId.trim())throw new Error('Xbox cloud title identity is missing');
      remote=await this.host.connectCloud({titleId,credentialRef,controllerProfileId:context.controllerProfileId});
    }else{
      const consoleId=game.metadata?.xboxConsoleId;
      if(typeof consoleId!=='string')throw new Error('Xbox console identity is missing');
      const console=(await this.discovery.discover()).find(candidate=>candidate.consoleId===consoleId&&candidate.available);
      if(!console)throw new Error('Xbox console is unavailable');
      remote=await this.host.connectHome({console,credentialRef,controllerProfileId:context.controllerProfileId});
    }
    return{runtimeSessionId:`xbox:${remote.sessionId}`,runtimeId:this.id,runtimeKind:this.runtimeKind,stop:()=>remote.stop()};
  }

  private accountId(game:GameLibraryEntry):string|undefined{
    const value=game.metadata?.xboxAccountId;
    return typeof value==='string'&&value.trim()?value:undefined;
  }
}

export type HighEndEmulatorSystem='gamecube'|'wii'|'ps2'|'ps3'|'psp'|'original-xbox';

export interface NativeEmulatorDefinition {
  system:HighEndEmulatorSystem;
  runtimeId:string;
  project:string;
  executableId:string;
}

export const HIGH_END_EMULATORS:readonly NativeEmulatorDefinition[]=Object.freeze([
  {system:'gamecube',runtimeId:'dolphin',project:'dolphin-emu/dolphin',executableId:'dolphin'},
  {system:'wii',runtimeId:'dolphin',project:'dolphin-emu/dolphin',executableId:'dolphin'},
  {system:'ps2',runtimeId:'pcsx2',project:'PCSX2/pcsx2',executableId:'pcsx2'},
  {system:'ps3',runtimeId:'rpcs3',project:'RPCS3/rpcs3',executableId:'rpcs3'},
  {system:'psp',runtimeId:'ppsspp',project:'hrydgard/ppsspp',executableId:'ppsspp'},
  {system:'original-xbox',runtimeId:'xemu',project:'xemu-project/xemu',executableId:'xemu'},
]);

export interface NativeEmulatorInstallation {
  executableId:string;
  version:string;
  executableHash:string;
  provenanceVerified:boolean;
  licenseReviewed:boolean;
}

export interface NativeEmulatorInventory {
  get(executableId:string):Promise<NativeEmulatorInstallation|undefined>;
}

export interface NativeEmulatorProcess {
  processId:string;
  stop():Promise<void>;
}

export interface NativeEmulatorLauncher {
  launch(input:{definition:NativeEmulatorDefinition;installation:NativeEmulatorInstallation;contentUri:string;saveId?:string;controllerProfileId?:string}):Promise<NativeEmulatorProcess>;
}

export class HighEndNativeEmulatorDriver implements ManagedGamingRuntimeDriver {
  readonly id='high-end-native-emulator';
  readonly runtimeKind='emulator' as const;

  constructor(private readonly inventory:NativeEmulatorInventory,private readonly launcher:NativeEmulatorLauncher){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    const definition=this.definition(game);
    if(!definition)return false;
    const installed=await this.inventory.get(definition.executableId);
    return Boolean(installed&&installed.version.trim()&&installed.executableHash.trim()&&installed.provenanceVerified&&installed.licenseReviewed);
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const definition=this.definition(game);
    if(!definition)throw new Error('No high-end emulator definition for game');
    const installation=await this.inventory.get(definition.executableId);
    if(!installation||!installation.provenanceVerified||!installation.licenseReviewed||!installation.executableHash.trim()){
      throw new Error('High-end emulator installation is not admitted');
    }
    const process=await this.launcher.launch({definition,installation,contentUri:game.contentUri,saveId:context.saveId,controllerProfileId:context.controllerProfileId});
    if(!process.processId.trim())throw new Error('High-end emulator process identity is empty');
    return{runtimeSessionId:`native-emulator:${definition.runtimeId}:${process.processId}`,runtimeId:this.id,runtimeKind:this.runtimeKind,stop:()=>process.stop()};
  }

  private definition(game:GameLibraryEntry):NativeEmulatorDefinition|undefined{
    const system=game.metadata?.highEndSystem;
    return typeof system==='string'?HIGH_END_EMULATORS.find(item=>item.system===system):undefined;
  }
}

export const G17_G18_ACCEPTANCE=Object.freeze({
  xbox:['home-stream','cloud-stream','controller-reconnect','managed-stop'] as const,
  nativeEmulators:['dolphin','pcsx2','rpcs3','ppsspp','xemu'] as const,
});
