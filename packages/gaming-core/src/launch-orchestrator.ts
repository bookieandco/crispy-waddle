import type { GameLibraryRepository, GameLibraryEntry } from './game-library.js';
import type { GameRuntimeAdapter, GameSession, LaunchContext } from './runtime.js';

export interface RuntimeAdapterResolver {
  resolve(game: GameLibraryEntry): Promise<GameRuntimeAdapter | undefined>;
}

export interface LaunchResult {
  game: GameLibraryEntry;
  session: GameSession;
  runtimeId: string;
}

export class UnifiedGameLaunchOrchestrator {
  constructor(
    private readonly library: GameLibraryRepository,
    private readonly resolver: RuntimeAdapterResolver,
  ) {}

  async launch(gameId: string, context: LaunchContext = {}): Promise<LaunchResult> {
    const game = await this.library.get(gameId);
    if (!game) throw new Error(`Game not found: ${gameId}`);

    const runtime = await this.resolver.resolve(game);
    if (!runtime) throw new Error(`No compatible runtime for game: ${gameId}`);

    if (!(await runtime.canLaunch(game))) {
      throw new Error(`Runtime ${runtime.runtime.id} cannot launch game: ${gameId}`);
    }

    const session = await runtime.launch(game, context);
    return { game, session, runtimeId: runtime.runtime.id };
  }
}
