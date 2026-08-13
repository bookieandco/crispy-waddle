// lib/admin/stats.ts
//
// Every number here is DERIVED from data/hotspots.ts and types/boutique.ts
// at call time — nothing is a hardcoded copy of "how many products we
// have today" that would silently go stale the next time a hotspot gets
// added or removed. The one thing this file can't derive from real data
// because it doesn't exist yet: order/revenue numbers. Those come from
// data/mockOrders.ts instead, which is explicitly demo data — see that
// file's own header before wiring a real number into these stats.

import { hotspots, Hotspot, ProductType } from "@/data/hotspots";
import { artStyles } from "@/types/boutique";

/** product types that are real, sellable catalog items — excludes the two
 * navigational hotspots (checkout, portraitStudio) that have no
 * fulfillment/pricing of their own. */
const NON_PRODUCT_TYPES: ProductType[] = ["checkout", "upload"];

export function getSellableHotspots(): Hotspot[] {
  return hotspots.filter((h) => !NON_PRODUCT_TYPES.includes(h.product));
}

export interface CategoryCount {
  category: ProductType;
  count: number;
}

/** Product listings per category (hotspot.product), sorted descending —
 * feeds the dashboard's bar chart. Categories with zero listings are
 * omitted rather than padded in, since an empty bar for a product type
 * that was removed entirely is noise, not signal. */
export function getCategoryCounts(): CategoryCount[] {
  const counts = new Map<ProductType, number>();
  for (const h of getSellableHotspots()) {
    counts.set(h.product, (counts.get(h.product) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export interface PriceStats {
  minCents: number;
  maxCents: number;
  /** average of each listing's lowest-priced variant */
  avgCents: number;
}

export function getPriceStats(): PriceStats | null {
  const prices: number[] = [];
  for (const h of getSellableHotspots()) {
    const variants = h.fulfillment?.variants ?? [];
    if (variants.length === 0) continue;
    prices.push(...variants.map((v) => v.priceCents));
  }
  if (prices.length === 0) return null;
  return {
    minCents: Math.min(...prices),
    maxCents: Math.max(...prices),
    avgCents: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
  };
}

/** Listings whose fulfillment.productId is still a PLACEHOLDER string —
 * i.e. not actually connected to a real Printful product yet. A real,
 * useful admin signal: how much of the catalog is launch-ready vs. still
 * needs its fulfillment mapping filled in. */
export function getUnfulfilledListings(): Hotspot[] {
  return getSellableHotspots().filter((h) =>
    h.fulfillment?.productId?.includes("PLACEHOLDER")
  );
}

export interface ArtStyleEngineCounts {
  openai: number;
  muapi: number;
  deterministic: number;
}

/** Which generation engine each art style actually routes through — see
 * app/api/generate-preview/route.ts for the real branch this mirrors.
 * Hardcoding the two non-OpenAI ids here (rather than importing the
 * route's branch logic, which isn't factored out as data) is a known
 * duplication — if a new style is added to a non-OpenAI engine without
 * updating this list, this stat silently misreports it. Small enough
 * surface (2 ids) that this is a documented tradeoff, not an oversight. */
export const MUAPI_STYLE_IDS = new Set(["studio-ghibli", "flux-dreamscape"]);
export const DETERMINISTIC_STYLE_IDS = new Set(["ascii-art"]);

export function getStyleEngine(
  styleId: string
): "OpenAI" | "Muapi" | "Deterministic" {
  if (MUAPI_STYLE_IDS.has(styleId)) return "Muapi";
  if (DETERMINISTIC_STYLE_IDS.has(styleId)) return "Deterministic";
  return "OpenAI";
}

export function getArtStyleEngineCounts(): ArtStyleEngineCounts {
  let openai = 0,
    muapi = 0,
    deterministic = 0;
  for (const s of artStyles) {
    if (MUAPI_STYLE_IDS.has(s.id)) muapi++;
    else if (DETERMINISTIC_STYLE_IDS.has(s.id)) deterministic++;
    else openai++;
  }
  return { openai, muapi, deterministic };
}

export function formatPriceCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
