import type {GameLibraryEntry} from './game-library.js';
import type {LaunchContext} from './runtime.js';
import type {ManagedGamingRuntimeDriver,ManagedRuntimeSession} from './gaming-session-orchestrator.js';

export interface NativeProcessHandle {
  processId:string;
  stop():Promise<void>;
}

export interface NativeProcessLauncher {
  launch(target:string,context:LaunchContext):Promise<NativeProcessHandle>;
}

export class NativePcManagedRuntimeDriver implements ManagedGamingRuntimeDriver {
  readonly id='native-pc';
  readonly runtimeKind='native' as const;

  constructor(private readonly launcher:NativeProcessLauncher){}

  async canStart(game:GameLibraryEntry):Promise<boolean>{
    return game.platform==='pc'&&(game.contentUri.startsWith('native://')||this.isSteamUri(game.contentUri));
  }

  async start(game:GameLibraryEntry,context:LaunchContext):Promise<ManagedRuntimeSession>{
    if(!(await this.canStart(game)))throw new Error(`Native PC runtime cannot start game: ${game.id}`);
    const handle=await this.launcher.launch(game.contentUri,context);
    if(!handle.processId.trim())throw new Error('Native process launcher returned an empty process id');
    return{
      runtimeSessionId:`process:${handle.processId}`,
      runtimeId:this.id,
      runtimeKind:this.runtimeKind,
      stop:()=>handle.stop(),
    };
  }

  private isSteamUri(uri:string):boolean{
    const match=/^steam:\/\/run\/(\d+)$/.exec(uri);
    return Boolean(match&&Number(match[1])>0);
  }
}
