import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';
import type {RemotePlaySessionCoordinator} from './remote-play-session.js';

export interface SunshinePairingGate {
  requirePaired(hostId:string):Promise<void>;
}

export class MoonlightManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='moonlight-remote';
  readonly runtimeKind='remote' as const;

  constructor(
    private readonly coordinator:RemotePlaySessionCoordinator,
    private readonly pairing:SunshinePairingGate,
  ){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    const parsed=this.parse(game.contentUri);
    if(!parsed)return false;
    try{
      await this.pairing.requirePaired(parsed.hostId);
      return true;
    }catch{
      return false;
    }
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const parsed=this.parse(game.contentUri);
    if(!parsed)throw new Error(`Moonlight runtime cannot start game: ${game.id}`);
    await this.pairing.requirePaired(parsed.hostId);
    const remote=await this.coordinator.start(game,context);
    return{
      runtimeSessionId:remote.session.id,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      stop:()=>this.coordinator.stop(remote.session.id),
    };
  }

  private parse(contentUri:string):{hostId:string;appId:string}|undefined{
    if(!contentUri.startsWith('moonlight://'))return undefined;
    const [hostId,appId]=contentUri.slice('moonlight://'.length).split('/');
    return hostId&&appId?{hostId,appId}:undefined;
  }
}
