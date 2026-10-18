import type { SocialPlatform } from "./social-intelligence"

export type SocialSourceAdapter = {
  id: string
  platform: SocialPlatform
  mode: "api" | "public_feed" | "licensed_data" | "manual"
  supports: Array<"posts" | "engagement" | "replies" | "search" | "history">
  requiresAuth: boolean
  notes: string
}

export const SOCIAL_SOURCE_ADAPTERS: SocialSourceAdapter[] = [
  {
    id: "x-api",
    platform: "x",
    mode: "api",
    supports: ["posts", "engagement", "replies", "search", "history"],
    requiresAuth: true,
    notes: "Use the official API and respect current access, rate, and data-use terms.",
  },
  {
    id: "bluesky-public",
    platform: "bluesky",
    mode: "public_feed",
    supports: ["posts", "replies", "search", "history"],
    requiresAuth: false,
    notes: "Public Bluesky feeds can be ingested without treating them as representative polling.",
  },
  {
    id: "reddit-api",
    platform: "reddit",
    mode: "api",
    supports: ["posts", "replies", "search", "history"],
    requiresAuth: true,
    notes: "Use Reddit's supported developer platform/API and current data-use terms.",
  },
  {
    id: "mastodon-public",
    platform: "mastodon",
    mode: "public_feed",
    supports: ["posts", "replies", "search", "history"],
    requiresAuth: false,
    notes: "Instance capabilities and public access vary by server.",
  },
  {
    id: "truth-social-public",
    platform: "truth_social",
    mode: "public_feed",
    supports: ["posts", "engagement", "replies"],
    requiresAuth: false,
    notes: "Use only content legally and technically available through permitted access paths.",
  },
  {
    id: "youtube-public",
    platform: "youtube",
    mode: "api",
    supports: ["posts", "engagement", "search", "history"],
    requiresAuth: true,
    notes: "Treat videos, titles and comments as separate evidence types.",
  },
  {
    id: "instagram-public",
    platform: "instagram",
    mode: "api",
    supports: ["posts", "engagement"],
    requiresAuth: true,
    notes: "Use authorized/official access; do not bypass access controls.",
  },
  {
    id: "tiktok-public",
    platform: "tiktok",
    mode: "api",
    supports: ["posts", "engagement", "search"],
    requiresAuth: true,
    notes: "Use permitted research/API access rather than bypassing platform controls.",
  },
  {
    id: "market-data",
    platform: "stocks",
    mode: "licensed_data",
    supports: ["posts", "search", "history"],
    requiresAuth: true,
    notes: "Social signals are paired with market-price/volume data but never treated as financial truth.",
  },
  {
    id: "crypto-social",
    platform: "crypto",
    mode: "licensed_data",
    supports: ["posts", "search", "history"],
    requiresAuth: true,
    notes: "Pair social signals with blockchain/market data and label sentiment as noisy evidence.",
  },
]
