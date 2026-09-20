import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {GameBoyRuntimeAdapter} from './gameboy-runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';

export interface GameBoyManagedHost {
  stop(sessionId:string):Promise<void>;
}

export class GameBoyManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='gameboy-wasm';
  readonly runtimeKind='emulator' as const;

  constructor(
    private readonly runtime:GameBoyRuntimeAdapter,
    private readonly host:GameBoyManagedHost,
  ){}

  canStart(game:GameLibraryEntry):Promise<boolean>{
    return this.runtime.canLaunch(game);
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    const session=await this.runtime.launch(game,context);
    return{
      runtimeSessionId:session.id,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      stop:()=>this.host.stop(session.id),
    };
  }
}
