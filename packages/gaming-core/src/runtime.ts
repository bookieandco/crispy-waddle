export type GamePlatform = 'gameboy' | 'gba' | 'nes' | 'snes' | 'genesis' | 'ps1' | 'ps2' | 'ps3' | 'ps4' | 'ps5' | 'pc' | 'cloud' | 'unknown';

export type RuntimeKind = 'emulator' | 'native' | 'cloud' | 'console';

export interface GameRuntime {
  id: string;
  name: string;
  platform: GamePlatform;
  kind: RuntimeKind;
  version?: string;
  capabilities?: readonly string[];
}

export interface GameRuntimeAdapter {
  runtime: GameRuntime;
  canLaunch(game: Game): Promise<boolean>;
  launch(game: Game, input: LaunchContext): Promise<GameSession>;
}

export interface Game {
  id: string;
  title: string;
  platform: GamePlatform;
  contentUri: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface LaunchContext {
  controllerProfileId?: string;
  saveId?: string;
  performanceProfileId?: string;
}

export interface GameSession {
  id: string;
  gameId: string;
  runtimeId: string;
  startedAt: string;
}

export class RuntimeResolver {
  constructor(private readonly adapters: readonly GameRuntimeAdapter[]) {}

  async resolve(game: Game): Promise<GameRuntimeAdapter> {
    for (const adapter of this.adapters) {
      if (await adapter.canLaunch(game)) return adapter;
    }
    throw new Error(`No compatible runtime found for ${game.platform}:${game.id}`);
  }
}
