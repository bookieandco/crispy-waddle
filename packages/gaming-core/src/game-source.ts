import type { GamePlatform } from './runtime.js';
import type { GameLibraryEntry } from './game-library.js';

export type GameSourceKind = 'local' | 'steam' | 'moonlight' | 'playstation' | 'native';

export interface GameSourceRecord {
  sourceId: string;
  source: GameSourceKind;
  title: string;
  platform: GamePlatform;
  contentUri: string;
  hostId?: string;
  artwork?: GameLibraryEntry['artwork'];
  metadata?: Readonly<Record<string, string>>;
}

export interface GameSourceAdapter {
  readonly source: GameSourceKind;
  discover(): Promise<readonly GameSourceRecord[]>;
}

export function normalizeGameSource(record: GameSourceRecord): GameLibraryEntry {
  if (!record.sourceId.trim()) throw new Error('Game source id is required');
  if (!record.title.trim()) throw new Error('Game title is required');
  if (!record.contentUri.trim()) throw new Error('Game content URI is required');
  return {
    id: `${record.source}:${record.sourceId}`,
    title: record.title,
    platform: record.platform,
    contentUri: record.contentUri,
    artwork: record.artwork,
    installed: record.source === 'local',
    tags: [record.source],
  };
}
