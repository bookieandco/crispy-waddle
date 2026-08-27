import type { CatalogItem } from "./catalog-search.js";
import type { MusicControllerState } from "./music-controller.js";
import { queueCatalogItems } from "./catalog-queue.js";
import { hydrateCatalogItem, type CatalogHydrator, type HydratableCatalogItem } from "./catalog-hydration.js";

/** Hydrates an album/artist/playlist and immediately turns its tracks into queue state. */
export async function hydrateAndQueueCatalogItem(
  state: MusicControllerState,
  item: HydratableCatalogItem,
  sourceId: string,
  hydrators: CatalogHydrator[],
  replace = false,
): Promise<MusicControllerState> {
  const hydrated = await hydrateCatalogItem(item, sourceId, hydrators);
  return queueCatalogItems(state, hydrated.tracks.map((track) => ({ kind: "track", track }) satisfies CatalogItem), replace);
}
