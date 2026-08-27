import type { SocialPlatform } from "./social-adapter"

export type SocialSourceCapability = {
  platform: SocialPlatform
  collectionModes: Array<"account" | "search" | "public-page" | "feed">
  requiresCredential: boolean
  supportsHistorical: boolean
  supportsEngagement: boolean
  enabled: boolean
  notes: string
}

/**
 * Capability metadata keeps source-specific constraints out of the relevance
 * and daily-log layers. Actual credentials/adapters are injected separately.
 */
export const SOCIAL_SOURCE_CAPABILITIES: SocialSourceCapability[] = [
  { platform: "x", collectionModes: ["account", "search"], requiresCredential: true, supportsHistorical: true, supportsEngagement: true, enabled: false, notes: "Enable after an authorized connector is configured." },
  { platform: "instagram", collectionModes: ["account", "public-page"], requiresCredential: true, supportsHistorical: false, supportsEngagement: true, enabled: false, notes: "Prefer official/authorized access where available." },
  { platform: "tiktok", collectionModes: ["account", "search"], requiresCredential: false, supportsHistorical: false, supportsEngagement: true, enabled: false, notes: "Use public/authorized collection only." },
  { platform: "facebook", collectionModes: ["account", "public-page"], requiresCredential: true, supportsHistorical: false, supportsEngagement: true, enabled: false, notes: "Use public pages or authorized APIs/connectors." },
  { platform: "youtube", collectionModes: ["account", "search"], requiresCredential: false, supportsHistorical: true, supportsEngagement: true, enabled: false, notes: "Prefer YouTube API/feed access." },
  { platform: "bluesky", collectionModes: ["account", "search", "feed"], requiresCredential: false, supportsHistorical: true, supportsEngagement: true, enabled: false, notes: "Use supported public APIs/feeds." },
  { platform: "reddit", collectionModes: ["account", "search", "feed"], requiresCredential: false, supportsHistorical: true, supportsEngagement: true, enabled: false, notes: "Use supported API/developer access and respect platform rules." },
  { platform: "mastodon", collectionModes: ["account", "search", "feed"], requiresCredential: false, supportsHistorical: true, supportsEngagement: true, enabled: false, notes: "Instance-specific public API capabilities apply." },
]
