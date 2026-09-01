export type GamePlatform = 'gameboy' | 'gba' | 'nes' | 'snes' | 'genesis' | 'ps1' | 'ps2' | 'ps3' | 'ps4' | 'ps5' | 'pc' | 'cloud' | 'unknown';
export type RuntimeKind = 'emulator' | 'native' | 'cloud' | 'console';
export interface GameRuntime { id:string; name:string; platform:GamePlatform; kind:RuntimeKind; version?:string; capabilities?:readonly string[]; }
export interface GameRuntimeAdapter { runtime:GameRuntime; canLaunch(game:Game):Promise<boolean>; launch(game:Game,input:LaunchContext):Promise<GameSession>; }
export interface Game { id:string; title:string; platform:GamePlatform; contentUri:string; metadata?:Readonly<Record<string,unknown>>; }
export interface LaunchContext { controllerProfileId?:string; saveId?:string; performanceProfileId?:string; }
export interface GameSession { id:string; gameId:string; runtimeId:string; startedAt:string; }
export interface RuntimeResolutionContext { preferredRuntimeIds?:readonly string[]; availableCapabilities?:readonly string[]; }
export interface RuntimeScore { adapter:GameRuntimeAdapter; score:number; }
export class RuntimeResolver {
  constructor(private readonly adapters:readonly GameRuntimeAdapter[]) {}
  async rank(game:Game, context:RuntimeResolutionContext={}):Promise<readonly RuntimeScore[]> {
    const candidates:RuntimeScore[]=[];
    for (const adapter of this.adapters) {
      if (!(await adapter.canLaunch(game))) continue;
      let score=adapter.runtime.platform===game.platform?100:0;
      if (context.preferredRuntimeIds?.includes(adapter.runtime.id)) score+=1000;
      for (const capability of adapter.runtime.capabilities ?? []) if (context.availableCapabilities?.includes(capability)) score+=10;
      candidates.push({adapter,score});
    }
    return candidates.sort((a,b)=>b.score-a.score || a.adapter.runtime.id.localeCompare(b.adapter.runtime.id));
  }
  async resolve(game:Game, context:RuntimeResolutionContext={}):Promise<GameRuntimeAdapter> {
    const ranked=await this.rank(game,context);
    if (!ranked[0]) throw new Error(`No compatible runtime found for ${game.platform}:${game.id}`);
    return ranked[0].adapter;
  }
}
