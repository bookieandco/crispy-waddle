import type { SocialPlatform } from "./social-adapter"

export type SocialSourceConfig = {
  id: string
  platform: SocialPlatform
  mode: "official_api" | "authorized_connector" | "public_web"
  enabled: boolean
  supports: Array<"account" | "search" | "mentions" | "trends">
  notes: string
}

/**
 * Configuration only: credentials and platform-specific clients stay outside
 * the shared intelligence layer. Public-web collection must respect source
 * policies and robots/access restrictions.
 */
export const SOCIAL_SOURCE_CONFIG: SocialSourceConfig[] = [
  {
    id: "x-public",
    platform: "x",
    mode: "public_web",
    enabled: false,
    supports: ["account", "search", "mentions"],
    notes: "Enable only with an approved collector and applicable access rules.",
  },
  {
    id: "instagram-public",
    platform: "instagram",
    mode: "public_web",
    enabled: false,
    supports: ["account", "search"],
    notes: "Prefer authorized/official access when available.",
  },
  {
    id: "tiktok-public",
    platform: "tiktok",
    mode: "public_web",
    enabled: false,
    supports: ["account", "search", "trends"],
    notes: "Use an approved adapter; do not collect private account data.",
  },
  {
    id: "facebook-public",
    platform: "facebook",
    mode: "public_web",
    enabled: false,
    supports: ["account", "search"],
    notes: "Prefer official/authorized access for supported resources.",
  },
  {
    id: "youtube-public",
    platform: "youtube",
    mode: "official_api",
    enabled: false,
    supports: ["account", "search", "mentions", "trends"],
    notes: "Use the official API credentials through a secret-managed connector.",
  },
]
