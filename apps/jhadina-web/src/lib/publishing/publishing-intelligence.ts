import type { JhadinaWorldId } from "../jhadina/jhadina-world-registry";
import type { PublishingProduct } from "./publishing-world";

export interface PublishingLifecycleEvent {
  id: string;
  productId: string;
  type: "created" | "research-captured" | "drafted" | "formatted" | "proofed" | "listed" | "published" | "sale" | "royalty";
  sourceWorld: JhadinaWorldId;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PublishingIntelligenceContext {
  product: PublishingProduct;
  linkedWorlds: JhadinaWorldId[];
  lifecycle: PublishingLifecycleEvent[];
  nextActions: string[];
  awareness: string[];
}

export const PUBLISHING_LINKED_WORLDS: JhadinaWorldId[] = [
  "studio", "knowledge", "publishing" as JhadinaWorldId, "shopping", "money", "activity", "home",
];

export function createPublishingEvent(input: Omit<PublishingLifecycleEvent, "id" | "timestamp">): PublishingLifecycleEvent {
  return { ...input, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
}

export function buildPublishingContext(product: PublishingProduct, lifecycle: PublishingLifecycleEvent[] = []): PublishingIntelligenceContext {
  const nextActions: string[] = [];
  if (product.status === "draft") nextActions.push("review manuscript", "format files", "prepare cover");
  if (product.status === "review") nextActions.push("complete proof and QA");
  if (product.status === "ready") nextActions.push("review metadata", "review price", "approve publication");
  if (product.status === "published") nextActions.push("monitor sales", "review royalties", "consider promotion");

  return {
    product,
    linkedWorlds: PUBLISHING_LINKED_WORLDS,
    lifecycle,
    nextActions,
    awareness: product.status === "published" ? ["watch sales", "surface promotion opportunities"] : ["surface blockers", "suggest next publishing step"],
  };
}
