export type SaveKind = 'persistent' | 'state';

export interface GameSave {
  id: string;
  gameId: string;
  kind: SaveKind;
  uri: string;
  createdAt: string;
  updatedAt: string;
  runtimeId?: string;
  slot?: number;
}

export interface SaveRepository {
  save(entry: GameSave): Promise<void>;
  get(saveId: string): Promise<GameSave | undefined>;
  list(gameId: string, kind?: SaveKind): Promise<readonly GameSave[]>;
  remove(saveId: string): Promise<void>;
}

export class InMemorySaveRepository implements SaveRepository {
  private readonly saves = new Map<string, GameSave>();
  async save(entry: GameSave): Promise<void> {
    if (!entry.id.trim()) throw new Error('Save id is required');
    if (!entry.gameId.trim()) throw new Error('Game id is required');
    if (!entry.uri.trim()) throw new Error('Save URI is required');
    this.saves.set(entry.id, Object.freeze({ ...entry }));
  }
  async get(saveId: string): Promise<GameSave | undefined> { return this.saves.get(saveId); }
  async list(gameId: string, kind?: SaveKind): Promise<readonly GameSave[]> {
    return [...this.saves.values()].filter((save) => save.gameId === gameId && (!kind || save.kind === kind));
  }
  async remove(saveId: string): Promise<void> { this.saves.delete(saveId); }
}
