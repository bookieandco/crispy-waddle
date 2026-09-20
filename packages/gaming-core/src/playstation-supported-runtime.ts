import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';
import {
  DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT,
  PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX,
  negotiatePlayStationController,
  type PlayStationControllerHardwareProfile,
} from './playstation-controller-hardware-profile.js';
import {AdaptiveGamingLatencyGovernor} from './adaptive-latency-governor.js';
import type {GamingDisplayRoute} from './display-routing.js';
import type {RemotePlayClass,RemoteQualitySample} from './remote-quality.js';

export const PLAYSTATION_REMOTE_PLAY_REFERENCE=Object.freeze({
  repository:'streetpea/chiaki-ng',
  role:'supported-remote-play-reference',
  supportedConsoleFamilies:['ps4','ps5'] as const,
});

export type PlayStationConsoleFamily='ps4'|'ps5';
export type PlayStationPowerState='awake'|'rest'|'offline'|'unknown';

export interface PlayStationConsole {
  consoleId:string;
  family:PlayStationConsoleFamily;
  name:string;
  address:string;
  powerState:PlayStationPowerState;
  discoveredAtMs:number;
}

export interface PlayStationDiscovery {
  discover():Promise<readonly PlayStationConsole[]>;
}

export interface PlayStationCredentialRecord {
  consoleId:string;
  secretRef:string;
  pairedAtMs:number;
}

export interface PlayStationCredentialVault {
  get(consoleId:string):Promise<PlayStationCredentialRecord|undefined>;
  put(record:PlayStationCredentialRecord):Promise<void>;
}

export interface PlayStationPairingBackend {
  pair(console:PlayStationConsole,pin:string):Promise<{secretRef:string}>;
}

export class PlayStationPairingService {
  constructor(private readonly vault:PlayStationCredentialVault,private readonly backend:PlayStationPairingBackend){}

  async pair(console:PlayStationConsole,pin:string,nowMs=Date.now()):Promise<PlayStationCredentialRecord>{
    if(!/^\d{4,8}$/.test(pin))throw new Error('PlayStation pairing PIN format is invalid');
    const result=await this.backend.pair(console,pin);
    if(!result.secretRef.trim())throw new Error('Pairing backend returned an empty secret reference');
    if(/token|credential|password/i.test(result.secretRef)&&result.secretRef.includes(':raw:')){
      throw new Error('Raw PlayStation credentials must not cross the vault boundary');
    }
    const record={consoleId:console.consoleId,secretRef:result.secretRef,pairedAtMs:nowMs};
    await this.vault.put(record);
    return record;
  }
}

export interface PlayStationRemoteSession {
  sessionId:string;
  stop():Promise<void>;
  pause?():Promise<void>;
  resume?():Promise<void>;
}

export interface PlayStationRemotePlayHost {
  wake(console:PlayStationConsole,credential:PlayStationCredentialRecord):Promise<void>;
  connect(input:{
    console:PlayStationConsole;
    credentialRef:string;
    remoteTitleId?:string;
    controllerProfileId?:string;
  }):Promise<PlayStationRemoteSession>;
}

export class PlayStationManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='playstation-remote-play';
  readonly runtimeKind='console' as const;

  constructor(
    private readonly discovery:PlayStationDiscovery,
    private readonly vault:PlayStationCredentialVault,
    private readonly host:PlayStationRemotePlayHost,
  ){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    if(game.platform!=='ps4'&&game.platform!=='ps5')return false;
    const consoleId=this.consoleId(game);
    if(!consoleId)return false;
    const [credential,consoles]=await Promise.all([this.vault.get(consoleId),this.discovery.discover()]);
    return Boolean(credential&&consoles.some(console=>console.consoleId===consoleId&&console.family===game.platform&&console.powerState!=='offline'));
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const consoleId=this.consoleId(game);
    if(!consoleId)throw new Error('PlayStation game is missing console identity');
    const consoles=await this.discovery.discover();
    const console=consoles.find(candidate=>candidate.consoleId===consoleId);
    if(!console)throw new Error(`PlayStation console not discovered: ${consoleId}`);
    if(console.powerState==='offline')throw new Error('PlayStation console is offline');
    const credential=await this.vault.get(consoleId);
    if(!credential)throw new Error('PlayStation console is not paired');

    if(console.powerState==='rest')await this.host.wake(console,credential);
    const remote=await this.host.connect({
      console,
      credentialRef:credential.secretRef,
      remoteTitleId:typeof game.metadata?.remoteTitleId==='string'?game.metadata.remoteTitleId:undefined,
      controllerProfileId:context.controllerProfileId,
    });
    if(!remote.sessionId.trim())throw new Error('PlayStation host returned an empty session id');
    return{
      runtimeSessionId:`playstation:${remote.sessionId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      pause:remote.pause?()=>remote.pause!():undefined,
      resume:remote.resume?()=>remote.resume!():undefined,
      stop:()=>remote.stop(),
    };
  }

  private consoleId(game:GameLibraryEntry):string|undefined{
    const id=game.metadata?.playStationConsoleId;
    return typeof id==='string'&&id.trim()?id:undefined;
  }
}

export interface PlayStationAcceptanceInput {
  controller:PlayStationControllerHardwareProfile;
  playClass:RemotePlayClass;
  quality:RemoteQualitySample;
  displayRoutes:readonly GamingDisplayRoute[];
}

export function evaluatePlayStationAcceptance(input:PlayStationAcceptanceInput){
  const controller=negotiatePlayStationController(input.controller,DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT);
  if(!controller.allowed)return{allowed:false as const,controller,latency:undefined};
  const latency=new AdaptiveGamingLatencyGovernor().evaluate(input.playClass,input.quality,input.displayRoutes);
  return{allowed:latency.action!=='block',controller,latency};
}

export const G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE=Object.freeze(
  PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX.map(entry=>({
    id:`${entry.profile.id}-ps5-remote-play`,
    controllerProfileId:entry.profile.id,
    path:entry.path,
    requiresDisconnectReconnect:true,
    requiresLatencyDegradation:true,
    requiresZeroResourceLeak:true,
  })),
);
