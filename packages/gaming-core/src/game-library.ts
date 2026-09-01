import type { Game, GamePlatform } from './runtime.js';

export interface GameArtwork {
  frontCoverUri?: string;
  backCoverUri?: string;
  iconUri?: string;
  screenshotUris?: readonly string[];
}

export interface GameLibraryEntry extends Game {
  artwork?: GameArtwork;
  installed?: boolean;
  favorite?: boolean;
  tags?: readonly string[];
}

export interface GameLibraryRepository {
  save(game: GameLibraryEntry): Promise<void>;
  get(gameId: string): Promise<GameLibraryEntry | undefined>;
  list(platform?: GamePlatform): Promise<readonly GameLibraryEntry[]>;
  remove(gameId: string): Promise<void>;
}

export class InMemoryGameLibrary implements GameLibraryRepository {
  private readonly games = new Map<string, GameLibraryEntry>();

  async save(game: GameLibraryEntry): Promise<void> {
    if (!game.id.trim()) throw new Error('Game id is required');
    if (!game.title.trim()) throw new Error('Game title is required');
    if (!game.contentUri.trim()) throw new Error('Game content URI is required');
    this.games.set(game.id, Object.freeze({ ...game, tags: game.tags ? [...game.tags] : undefined }));
  }

  async get(gameId: string): Promise<GameLibraryEntry | undefined> {
    return this.games.get(gameId);
  }

  async list(platform?: GamePlatform): Promise<readonly GameLibraryEntry[]> {
    const games = [...this.games.values()];
    return platform ? games.filter((game) => game.platform === platform) : games;
  }

  async remove(gameId: string): Promise<void> {
    this.games.delete(gameId);
  }
}
