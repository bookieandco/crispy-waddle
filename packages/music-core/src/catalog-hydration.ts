import type { Album, Artist, Playlist, Track } from "./types.js";
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
export async function hydrateCatalogItem(item: HydratableCatalogItem, hydrators: CatalogHydrator[]): Promise<HydratedCatalogItem> {
  const hydrator = hydrators.find((candidate) => candidate.sourceId === sourceIdOf(item));
  if (!hydrator) throw new Error(`No catalog hydrator for source: ${sourceIdOf(item)}`);
  return { item, tracks: await hydrator.hydrate(item) };
}

function sourceIdOf(item: HydratableCatalogItem): string {
  const value = item[item.kind] as Album | Artist | Playlist;
  const sourceId = "sourceId" in value ? value.sourceId : undefined;
  if (typeof sourceId !== "string" || !sourceId) throw new Error(`Catalog ${item.kind} is missing sourceId`);
  return sourceId;
}
