import type { Game, GameRuntimeAdapter, GameSession, LaunchContext } from './runtime.js';

export interface GameBoyRuntimeHost {
  launch(contentUri: string, input: LaunchContext): Promise<{ sessionId: string }>;
}

export class GameBoyRuntimeAdapter implements GameRuntimeAdapter {
  readonly runtime = {
    id: 'gameboy-wasm',
    name: 'Jhadina Game Boy WASM Runtime',
    platform: 'gameboy' as const,
    kind: 'emulator' as const,
    capabilities: ['wasm', 'save-state', 'controller-input'],
  };

  constructor(private readonly host: GameBoyRuntimeHost) {}

  async canLaunch(game: Game): Promise<boolean> {
    return game.platform === 'gameboy' && game.contentUri.length > 0;
  }

  async launch(game: Game, input: LaunchContext): Promise<GameSession> {
    if (!(await this.canLaunch(game))) throw new Error(`Game Boy runtime cannot launch ${game.platform}:${game.id}`);
    const result = await this.host.launch(game.contentUri, input);
    return { id: result.sessionId, gameId: game.id, runtimeId: this.runtime.id, startedAt: new Date().toISOString() };
  }
}
