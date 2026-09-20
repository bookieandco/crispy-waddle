export type GamePlatform = 'gameboy' | 'gbc' | 'gba' | 'nes' | 'snes' | 'genesis' | 'ps1' | 'ps2' | 'ps3' | 'ps4' | 'ps5' | 'pc' | 'cloud';

export type RuntimeKind = 'emulator' | 'native' | 'cloud' | 'console';

export interface GameRuntime {
  id: string;
  name: string;
  kind: RuntimeKind;
  platforms: readonly GamePlatform[];
  version?: string;
}

export interface RuntimeResolver {
  register(runtime: GameRuntime): void;
  unregister(runtimeId: string): void;
  list(): readonly GameRuntime[];
  resolve(platform: GamePlatform): GameRuntime[];
}

export class InMemoryRuntimeRegistry implements RuntimeResolver {
  private readonly runtimes = new Map<string, GameRuntime>();

  register(runtime: GameRuntime): void {
    if (!runtime.id.trim()) throw new Error('Runtime id is required');
    if (!runtime.name.trim()) throw new Error('Runtime name is required');
    if (runtime.platforms.length === 0) throw new Error('Runtime must support at least one platform');
    this.runtimes.set(runtime.id, Object.freeze({ ...runtime, platforms: [...runtime.platforms] }));
  }

  unregister(runtimeId: string): void {
    this.runtimes.delete(runtimeId);
  }

  list(): readonly GameRuntime[] {
    return [...this.runtimes.values()];
  }

  resolve(platform: GamePlatform): GameRuntime[] {
    return this.list().filter((runtime) => runtime.platforms.includes(platform));
  }
}
