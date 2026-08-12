import type { JhadinaWorldId } from "./jhadina-world-registry";

export interface WorldUpgrade {
  worldId: JhadinaWorldId;
  surface: string[];
  intelligence: string[];
  awareness: string[];
  actions: string[];
}

export const WORLD_UPGRADES: WorldUpgrade[] = [
  { worldId: "home", surface: ["personalized-feed", "continue-cards", "awareness-rail"], intelligence: ["cross-world-recommendations"], awareness: ["daily-priorities", "things-you-might-like"], actions: ["open-world", "ask-jhadina"] },
  { worldId: "music", surface: ["hero-player", "recommendation-rails", "artist-cards"], intelligence: ["taste-profile", "listening-context"], awareness: ["new-releases", "mood-picks"], actions: ["play", "queue", "save"] },
  { worldId: "tv", surface: ["cinematic-hero", "preview-cards", "continue-watching"], intelligence: ["watch-history", "taste-profile"], awareness: ["new-arrivals", "leaving-soon"], actions: ["watch", "save", "resume"] },
  { worldId: "studio", surface: ["project-grid", "asset-browser", "creation-workbench"], intelligence: ["project-context", "creative-memory"], awareness: ["unfinished-work", "asset-needs"], actions: ["create", "edit", "export"] },
  { worldId: "social", surface: ["feed", "creator-cards", "composer"], intelligence: ["audience-context", "content-memory"], awareness: ["drafts", "publishing-windows"], actions: ["draft", "schedule", "publish"] },
  { worldId: "pupsonstuff", surface: ["product-showcase", "3d-preview", "order-cards"], intelligence: ["customer-context", "product-context"], awareness: ["orders", "campaign-opportunities"], actions: ["create-product", "preview", "manage-order"] },
  { worldId: "trucker", surface: ["trip-dashboard", "load-cards", "profit-cards"], intelligence: ["trip-context", "business-context"], awareness: ["loads", "expenses", "route-events"], actions: ["log-trip", "calculate", "track"] },
  { worldId: "cooking", surface: ["recipe-hero", "ingredient-cards", "drink-cards"], intelligence: ["taste-profile", "inventory-context"], awareness: ["what-to-cook", "missing-ingredients"], actions: ["cook", "shop", "start-timer"] },
  { worldId: "shopping", surface: ["search-results", "comparison-cards", "watchlist-rail"], intelligence: ["shopping-preferences", "purchase-history"], awareness: ["price-drops", "matches", "nearby-stock"], actions: ["save", "watch", "buy"] },
  { worldId: "radar", surface: ["live-feed", "map-cards", "tonight-rail"], intelligence: ["location-context", "interest-profile"], awareness: ["events", "deals", "things-you-might-like"], actions: ["save", "remind", "navigate"] },
  { worldId: "knowledge", surface: ["research-feed", "source-cards", "digest-view"], intelligence: ["knowledge-graph", "memory-context"], awareness: ["follow-ups", "uncertainty"], actions: ["research", "save", "verify"] },
  { worldId: "money", surface: ["financial-dashboard", "decision-cards", "goal-rails"], intelligence: ["financial-context", "policy-context"], awareness: ["bills", "cash-flow", "risks"], actions: ["review", "plan", "approve"] },
  { worldId: "opportunities", surface: ["opportunity-feed", "lead-cards", "pipeline"], intelligence: ["qualification-context", "research-context"], awareness: ["new-matches", "follow-ups"], actions: ["qualify", "track", "open"] },
  { worldId: "activity", surface: ["timeline", "audit-cards", "approval-queue"], intelligence: ["cross-world-context"], awareness: ["pending-approvals", "failed-actions"], actions: ["approve", "undo", "inspect"] },
];

export function getWorldUpgrade(worldId: JhadinaWorldId) {
  return WORLD_UPGRADES.find((upgrade) => upgrade.worldId === worldId);
}
