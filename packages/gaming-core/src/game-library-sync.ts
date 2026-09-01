import type { GameLibraryEntry, GameLibraryRepository } from './game-library.js';
import { normalizeGameSource, type GameSourceRecord } from './game-source.js';

export interface GameLibrarySyncResult { added: number; updated: number; unchanged: number; }

export async function syncGameSources(repository: GameLibraryRepository, sources: readonly GameSourceRecord[]): Promise<GameLibrarySyncResult> {
  let added = 0; let updated = 0; let unchanged = 0;
  for (const source of sources) {
    const game = normalizeGameSource(source);
    const existing = await repository.get(game.id);
    if (!existing) { await repository.save(game); added++; continue; }
    const merged: GameLibraryEntry = { ...existing, ...game, artwork: game.artwork ?? existing.artwork, favorite: existing.favorite };
    const changed = JSON.stringify(existing) !== JSON.stringify(merged);
    if (changed) { await repository.save(merged); updated++; } else unchanged++;
  }
  return { added, updated, unchanged };
}
