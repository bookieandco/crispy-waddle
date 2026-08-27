import type { Track } from "./types.js";
import type { CatalogItem } from "./catalog-search.js";

export type HydratableCatalogItem = Extract<CatalogItem, { kind: "album" | "artist" | "playlist" }>;

export interface CatalogHydrator {
  readonly sourceId: string;
  hydrate(item: HydratableCatalogItem): Promise<Track[]>;
}

export interface HydratedCatalogItem {
  item: CatalogItem;
  tracks: Track[];
}

/** Turns discovery objects into concrete tracks without coupling Music Core to a provider. */
export async function hydrateCatalogItem(item: HydratableCatalogItem, sourceId: string, hydrators: CatalogHydrator[]): Promise<HydratedCatalogItem> {
  const normalizedSourceId = sourceId.trim();
  if (!normalizedSourceId) throw new Error("Catalog hydration requires a sourceId");
  const hydrator = hydrators.find((candidate) => candidate.sourceId === normalizedSourceId);
  if (!hydrator) throw new Error(`No catalog hydrator for source: ${normalizedSourceId}`);
  return { item, tracks: await hydrator.hydrate(item) };
}
