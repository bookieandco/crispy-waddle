import type { TrendObservation } from "./trendScout"

export type WebTrendSearchOptions = {
  query: string
  freshnessDays?: number
  domains?: string[]
}

type SearchResult = { title?: string; url?: string; snippet?: string; publishedAt?: string }

/** Provider-neutral web search adapter. Set WEB_SEARCH_URL and WEB_SEARCH_API_KEY in deployment secrets. */
export async function searchWebTrends(options: WebTrendSearchOptions): Promise<TrendObservation[]> {
  const endpoint = process.env.WEB_SEARCH_URL
  const apiKey = process.env.WEB_SEARCH_API_KEY
  if (!endpoint || !apiKey) throw new Error("Web trend search is not configured. Set WEB_SEARCH_URL and WEB_SEARCH_API_KEY.")

  const url = new URL(endpoint)
  url.searchParams.set("q", options.query)
  if (options.freshnessDays) url.searchParams.set("freshness", String(options.freshnessDays))
  if (options.domains?.length) url.searchParams.set("domains", options.domains.join(","))

  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store" })
  if (!response.ok) throw new Error(`Web trend provider returned ${response.status}`)
  const payload = await response.json() as { results?: SearchResult[] }

  return (payload.results || []).map(result => ({
    source: "web",
    title: result.title || "Untitled result",
    url: result.url,
    observedAt: result.publishedAt || new Date().toISOString(),
    signals: { topic: options.query },
    evidence: result.snippet ? [result.snippet] : [],
  }))
}
