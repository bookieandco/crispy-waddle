/**
 * Jhadina Super Feed: portable, read-only feed coordination inspired by
 * lonekorean/super-feed (MIT, copyright 2017 Will Boyd). No legacy
 * Instagram v1, X/Twitter scraping, background thread or unsafe token flow.
 */
export type PublicFeedProvider = "github" | "youtube" | "wordpress"
export interface PublicFeedSource {
  provider: PublicFeedProvider
  identifier: string
  label: string
}
export interface PublicFeedItem {
  id: string
  sourceId: string
  provider: PublicFeedProvider
  title: string
  url: string
  publishedAt: string
  summary: string
  provenance: "official_public_feed"
}
export interface PublicFeedResult {
  source: PublicFeedSource
  state: "ok" | "unavailable"
  items: PublicFeedItem[]
}
export const MAX_PUBLIC_SOURCES = 4
export const MAX_PUBLIC_FEED_ITEMS = 30

const IDENTIFIERS = {
  github: /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i,
  youtube: /^UC[A-Za-z0-9_-]{22}$/,
  wordpress: /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i,
} as const

/** Only explicitly generated host URLs, never arbitrary owner-supplied URLs. */
export function publicFeedSource(provider: PublicFeedProvider, identifier: string): PublicFeedSource {
  const cleaned = identifier.trim()
  // Next.js may canonicalize 127.0.0.1 to localhost in dev/test URLs.
  // These are external profile *identifiers*, never hosts or loopback names.
  if (cleaned.toLowerCase() === "localhost" ||
      !IDENTIFIERS[provider]?.test(cleaned)) throw new Error("PUBLIC_FEED_SOURCE_INVALID")
  const canonical = provider === "youtube" ? cleaned : cleaned.toLowerCase()
  return { provider, identifier: canonical, label: provider + ":" + canonical }
}
export function publicFeedUrl(source: PublicFeedSource): string {
  const { provider, identifier } = publicFeedSource(source.provider, source.identifier)
  if (provider === "github") return `https://github.com/${identifier}.atom`
  if (provider === "youtube") return `https://www.youtube.com/feeds/videos.xml?channel_id=${identifier}`
  return `https://${identifier}.wordpress.com/feed/`
}

/**
 * Balance the newest items across sources so one noisy channel cannot consume
 * the entire feed. Each source gets up to 2 picks before other remaining
 * sources, with no more than 2 consecutive items from one source.
 * Never synthesizes a timestamp, post, like or follow.
 */
export function mergePublicFeeds(
  results: readonly PublicFeedResult[],
  options: { limit?: number; minPerSource?: number; streakLimit?: number } = {},
): PublicFeedItem[] {
  const limit = Math.max(1, Math.min(MAX_PUBLIC_FEED_ITEMS, options.limit ?? 20))
  const minPerSource = Math.max(0, Math.min(3, options.minPerSource ?? 2))
  const streakLimit = Math.max(1, Math.min(3, options.streakLimit ?? 2))
  const groups = new Map<string, PublicFeedItem[]>()
  const seen = new Set<string>()
  for (const result of results) {
    if (result.state !== "ok") continue
    for (const item of result.items) {
      if (!Number.isFinite(Date.parse(item.publishedAt))) continue
      const key = item.url.trim()
      if (!key || seen.has(key)) continue
      seen.add(key)
      const group = groups.get(item.sourceId) ?? []
      group.push(item)
      groups.set(item.sourceId, group)
    }
  }
  for (const group of groups.values()) {
    group.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id))
  }
  const ordered = [...groups.keys()].sort((a, b) =>
    Date.parse(groups.get(b)![0]?.publishedAt ?? "1970-01-01") -
    Date.parse(groups.get(a)![0]?.publishedAt ?? "1970-01-01") || a.localeCompare(b))
  const out: PublicFeedItem[] = []
  const counts = new Map<string, number>()
  let previous = "", streak = 0
  while (out.length < limit) {
    const candidates = ordered.filter(k => (groups.get(k)?.length ?? 0) > 0)
    if (!candidates.length) break
    const allowed = candidates.filter(k => !(k === previous && streak >= streakLimit))
    const pool = allowed.length ? allowed : candidates
    pool.sort((a, b) => {
      const pa = (counts.get(a) ?? 0) < minPerSource ? 0 : 1
      const pb = (counts.get(b) ?? 0) < minPerSource ? 0 : 1
      if (pa !== pb) return pa - pb
      return Date.parse(groups.get(b)![0]!.publishedAt) -
        Date.parse(groups.get(a)![0]!.publishedAt) || a.localeCompare(b)
    })
    const pick = pool[0]!
    const item = groups.get(pick)!.shift()!
    out.push(item)
    counts.set(pick, (counts.get(pick) ?? 0) + 1)
    streak = pick === previous ? streak + 1 : 1
    previous = pick
  }
  return out
}
