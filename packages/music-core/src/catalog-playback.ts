import type { CatalogItem } from "./catalog-search.js";
import type { Track } from "./types.js";
import type { JhadinaMusicPlaybackAdapter } from "./jhadina-music-playback-adapter.js";

export type CatalogPlaybackItem = Extract<CatalogItem, { kind: "track" }>;

/** Converts a discovered catalog item into the existing user-scoped playback path. */
export async function playCatalogItem(
  item: CatalogPlaybackItem,
  playback: JhadinaMusicPlaybackAdapter,
): Promise<void> {
  const track: Track = item.track;
  await playback.play(track);
}
