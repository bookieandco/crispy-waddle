import type { ShoppingSearchRequest, ShoppingResult } from "../shopping/universal-shopping";

export type WatchTrigger = "match_found" | "price_at_or_below" | "available_nearby";
export type WatchStatus = "active" | "paused" | "fulfilled" | "expired";

export interface ShoppingWatch {
  id: string;
  request: ShoppingSearchRequest;
  trigger: WatchTrigger;
  targetPrice?: number;
  status: WatchStatus;
  createdAt: string;
  expiresAt?: string;
  lastCheckedAt?: string;
}

export interface ShoppingAwarenessItem {
  id: string;
  watchId: string;
  title: string;
  reason: string;
  level: "silent" | "suggest" | "important";
  result: ShoppingResult;
  createdAt: string;
}

export function createShoppingWatch(input: Omit<ShoppingWatch, "id" | "status" | "createdAt">): ShoppingWatch {
  return {
    ...input,
    id: crypto.randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function evaluateShoppingWatch(watch: ShoppingWatch, results: ShoppingResult[]): ShoppingAwarenessItem[] {
  if (watch.status !== "active") return [];

  return results
    .filter((result) => {
      if (watch.trigger === "price_at_or_below") return watch.targetPrice != null && result.price != null && result.price <= watch.targetPrice;
      if (watch.trigger === "available_nearby") return Boolean(result.availability) && result.distanceMiles != null;
      return true;
    })
    .map((result) => ({
      id: crypto.randomUUID(),
      watchId: watch.id,
      title: `Found a match: ${result.title}`,
      reason: watch.trigger === "price_at_or_below" ? `It's at or below your ${watch.targetPrice} target.` : watch.trigger === "available_nearby" ? `It's available nearby.` : `It matches what you asked me to watch for.`,
      level: "suggest",
      result,
      createdAt: new Date().toISOString(),
    }));
}

export function expireShoppingWatch(watch: ShoppingWatch, now = new Date()): ShoppingWatch {
  return watch.expiresAt && new Date(watch.expiresAt) <= now ? { ...watch, status: "expired" } : watch;
}
