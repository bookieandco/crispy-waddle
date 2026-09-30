import type { SocialCollectionRequest, SocialPost, SocialPlatform } from "./social-adapter"

export type WebCollector = {
  name: string
  collect: (input: { url: string; query?: string; since?: string; limit?: number }) => Promise<unknown[]>
}

export type SocialWebRecord = {
  id: string
  url: string
  platform?: SocialPlatform
  authorId?: string
  authorName?: string
  publishedAt?: string
  text?: string
  engagement?: SocialPost["engagement"]
}

const SUPPORTED_PUBLIC_PLATFORMS = new Set<SocialPlatform>([
  "x", "instagram", "tiktok", "facebook", "youtube", "bluesky", "reddit", "mastodon",
])

function asRecord(value: unknown): SocialWebRecord | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || typeof record.url !== "string") return null
  return {
    id: record.id,
    url: record.url,
    platform: typeof record.platform === "string" && SUPPORTED_PUBLIC_PLATFORMS.has(record.platform as SocialPlatform)
      ? (record.platform as SocialPlatform)
      : undefined,
    authorId: typeof record.authorId === "string" ? record.authorId : undefined,
    authorName: typeof record.authorName === "string" ? record.authorName : undefined,
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    text: typeof record.text === "string" ? record.text : undefined,
    engagement: typeof record.engagement === "object" && record.engagement !== null
      ? record.engagement as SocialPost["engagement"]
      : undefined,
  }
}

/**
 * Adapter boundary for Firecrawl/Crawlee/Scrapling-style collectors.
 * Collector credentials and platform-specific access logic remain external.
 */
export async function collectPublicSocialWeb(
  collector: WebCollector,
  request: SocialCollectionRequest,
): Promise<SocialPost[]> {
  const url = request.accountUrl ?? ""
  if (!url) throw new Error("A public source URL is required")

  const raw = await collector.collect({
    url,
    query: request.query,
    since: request.since,
    limit: request.limit,
  })

  return raw
    .map(asRecord)
    .filter((record): record is SocialWebRecord => Boolean(record?.text && record.platform))
    .map((record) => ({
      id: record.id,
      platform: record.platform!,
      authorId: record.authorId,
      authorName: record.authorName,
      url: record.url,
      publishedAt: record.publishedAt ?? new Date().toISOString(),
      text: record.text!,
      engagement: record.engagement,
    }))
}
