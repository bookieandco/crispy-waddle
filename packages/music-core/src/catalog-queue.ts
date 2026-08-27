import type { CatalogItem } from "./catalog-search.js";
import type { Track } from "./types.js";
import type { MusicControllerState } from "./music-controller.js";

export type QueueableCatalog = Extract<CatalogItem, { kind: "track" }>;

export function tracksFromCatalog(items: CatalogItem[]): Track[] {
  return items.flatMap((item) => item.kind === "track" ? [item.track] : []);
}

export function queueCatalogItems(state: MusicControllerState, items: CatalogItem[], replace = false): MusicControllerState {
  const tracks = tracksFromCatalog(items);
  if (!tracks.length) return state;
  const queue = replace ? tracks : [...state.queue, ...tracks];
  return { ...state, queue, queueIndex: replace ? 0 : state.queueIndex };
}

export function queueCatalogItem(state: MusicControllerState, item: QueueableCatalog, replace = false): MusicControllerState {
  return queueCatalogItems(state, [item], replace);
}
