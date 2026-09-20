import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';
import type {Ps5ExperimentalReference} from './ps5-experimental-catalog.js';
import {assertPs5ExperimentalAuthorized,type Ps5ExperimentalAuthorizationContext} from './ps5-experimental-policy.js';

export interface Ps5ObservedConsole {
  consoleId:string;
  name:string;
  state:'awake'|'standby'|'unknown';
}

export interface Ps5MqttObservationClient {
  discover():Promise<readonly Ps5ObservedConsole[]>;
}

export class Ps5MqttObservationAdapter {
  constructor(
    private readonly client:Ps5MqttObservationClient,
    private readonly reference:Ps5ExperimentalReference,
  ){}

  async discover(context:Omit<Ps5ExperimentalAuthorizationContext,'reference'|'action'>):Promise<readonly Ps5ObservedConsole[]>{
    assertPs5ExperimentalAuthorized({...context,reference:this.reference,action:'state-observe'});
    return this.client.discover();
  }
}

export interface ExperimentalEmulatorProcess {
  processId:string;
  stop():Promise<void>;
}
export interface ExperimentalEmulatorLauncher {
  launch(game:GameLibraryEntry,context:LaunchContext):Promise<ExperimentalEmulatorProcess>;
}

export class KytyExperimentalRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='kyty-ps5-experimental';
  readonly runtimeKind='emulator' as const;

  constructor(
    private readonly launcher:ExperimentalEmulatorLauncher,
    private readonly reference:Ps5ExperimentalReference,
    private readonly authorize:()=>Omit<Ps5ExperimentalAuthorizationContext,'reference'|'action'>,
  ){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    if(game.platform!=='ps5'&&game.platform!=='ps4')return false;
    try{
      assertPs5ExperimentalAuthorized({...this.authorize(),reference:this.reference,action:'emulator-launch'});
      return true;
    }catch{
      return false;
    }
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    assertPs5ExperimentalAuthorized({...this.authorize(),reference:this.reference,action:'emulator-launch'});
    const process=await this.launcher.launch(game,context);
    if(!process.processId.trim())throw new Error('Experimental emulator returned an empty process id');
    return{
      runtimeSessionId:`kyty:${process.processId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      stop:()=>process.stop(),
    };
  }
}

export interface Ps5PayloadMetadataRecord {
  name:string;
  version?:string;
  description?:string;
  sourceRepository?:string;
}

export class Ps5PayloadMetadataAdapter {
  constructor(private readonly reference:Ps5ExperimentalReference){}

  sanitize(
    entries:readonly Ps5PayloadMetadataRecord[],
    context:Omit<Ps5ExperimentalAuthorizationContext,'reference'|'action'>,
  ):readonly Ps5PayloadMetadataRecord[]{
    assertPs5ExperimentalAuthorized({...context,reference:this.reference,action:'homebrew-metadata'});
    return entries.map(entry=>({
      name:entry.name.trim(),
      version:entry.version?.trim(),
      description:entry.description?.trim(),
      sourceRepository:entry.sourceRepository?.trim(),
    })).filter(entry=>entry.name.length>0);
  }
}
