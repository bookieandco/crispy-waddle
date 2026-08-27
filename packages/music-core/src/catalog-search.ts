import type { Album, Artist, Playlist, Track } from "./types.js";
import { searchTracks, type MusicSearchResult } from "./search.js";

export type CatalogItem =
  | { kind: "track"; track: Track }
  | { kind: "artist"; artist: Artist }
  | { kind: "album"; album: Album }
  | { kind: "playlist"; playlist: Playlist };

export interface CatalogSearchProvider {
  readonly sourceId: string;
  search(query: string): Promise<CatalogItem[]>;
}

export interface CatalogSearchResult {
  sourceId: string;
  items: CatalogItem[];
}

/** Provider-neutral discovery. Providers supply metadata; Music Core owns ranking/merging. */
export async function searchCatalog(
  query: string,
  providers: CatalogSearchProvider[],
  localTracks: Track[] = [],
): Promise<CatalogSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const local: MusicSearchResult[] = searchTracks(localTracks, normalized);
  const results: CatalogSearchResult[] = [];
  if (local.length) results.push({ sourceId: "local", items: local.map(({ track }) => ({ kind: "track", track })) });

  const providerResults = await Promise.all(providers.map(async (provider) => ({ sourceId: provider.sourceId, items: await provider.search(normalized) })));
  return [...results, ...providerResults.filter((result) => result.items.length > 0)];
}
