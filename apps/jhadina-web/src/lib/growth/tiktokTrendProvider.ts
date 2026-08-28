import type { TrendObservation } from "./trendScout"

const BASE_URL = "https://api.tikapi.io"

type TikApiItem = {
  id?: string
  desc?: string
  text?: string
  title?: string
  webVideoUrl?: string
  video?: { playAddr?: string }
  author?: { uniqueId?: string; nickname?: string }
  stats?: { playCount?: number; diggCount?: number; commentCount?: number; shareCount?: number }
  createTime?: number
}

type TikApiResponse = {
  data?: TikApiItem[]
  itemList?: TikApiItem[]
  cursor?: string
}

export type TikTokTrendSearchOptions = {
  query: string
  country?: string
  maxPages?: number
}

/**
 * Provider-neutral TikTok discovery adapter backed by TikAPI.
 * It is intentionally read-only: discovery observations are separated from
 * publishing and must flow through the Growth approval boundary before use.
 */
export async function searchTikTokTrends(options: TikTokTrendSearchOptions): Promise<TrendObservation[]> {
  const apiKey = process.env.TIKAPI_API_KEY
  if (!apiKey) throw new Error("TikTok trend search is not configured. Set TIKAPI_API_KEY.")

  const maxPages = Math.min(Math.max(options.maxPages ?? 1, 1), 5)
  let cursor: string | undefined
  const observations: TrendObservation[] = []

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${BASE_URL}/public/search/general`)
    url.searchParams.set("query", options.query)
    if (options.country) url.searchParams.set("country", options.country)
    if (cursor) url.searchParams.set("nextCursor", cursor)

    const response = await fetch(url, {
      headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`TikAPI trend provider returned ${response.status}`)

    const payload = await response.json() as TikApiResponse
    const items = payload.data ?? payload.itemList ?? []

    for (const item of items) {
      const stats = item.stats ?? {}
      const engagement = (stats.diggCount ?? 0) + (stats.commentCount ?? 0) + (stats.shareCount ?? 0)
      const title = item.desc || item.text || item.title || `${options.query} TikTok result`
      observations.push({
        source: "tiktok",
        title,
        url: item.webVideoUrl,
        observedAt: item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString(),
        signals: {
          topic: options.query,
          engagement,
          format: item.video?.playAddr ? "video" : undefined,
        },
        evidence: [
          item.author?.uniqueId ? `creator:@${item.author.uniqueId}` : undefined,
          stats.playCount != null ? `views:${stats.playCount}` : undefined,
          stats.diggCount != null ? `likes:${stats.diggCount}` : undefined,
          stats.commentCount != null ? `comments:${stats.commentCount}` : undefined,
          stats.shareCount != null ? `shares:${stats.shareCount}` : undefined,
        ].filter(Boolean) as string[],
      })
    }

    cursor = payload.cursor
    if (!cursor || !items.length) break
  }

  return observations
}
