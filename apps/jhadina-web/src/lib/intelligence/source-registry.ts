export type IntelligenceDomain = "campaign" | "social" | "money" | "overage" | "general"

export type CollectionMethod = "api" | "feed" | "webhook" | "browser" | "http" | "manual"

export type SourceWatch = {
  id: string
  name: string
  domain: IntelligenceDomain
  url: string
  method: CollectionMethod
  cadenceMinutes: number
  enabled: boolean
  priority: "low" | "normal" | "high" | "critical"
  tags: string[]
}

/** Shared watch registry. Adapters execute collection; the registry decides what matters. */
export const SOURCE_WATCHES: SourceWatch[] = [
  {
    id: "campaign-public-polls",
    name: "Campaign polling sources",
    domain: "campaign",
    url: "https://www.pewresearch.org/politics/",
    method: "http",
    cadenceMinutes: 360,
    enabled: true,
    priority: "high",
    tags: ["polling", "public-opinion"],
  },
  {
    id: "fec-filings",
    name: "Federal campaign finance filings",
    domain: "campaign",
    url: "https://www.fec.gov/data/",
    method: "api",
    cadenceMinutes: 360,
    enabled: true,
    priority: "high",
    tags: ["finance", "elections"],
  },
  {
    id: "overage-government-pages",
    name: "Tracked government opportunity pages",
    domain: "overage",
    url: "https://www.usa.gov/state-local-governments",
    method: "http",
    cadenceMinutes: 1440,
    enabled: true,
    priority: "high",
    tags: ["government", "surplus", "unclaimed-property"],
  },
  {
    id: "social-public-watchlist",
    name: "Configured public social accounts",
    domain: "social",
    url: "https://example.invalid/social-watchlist",
    method: "browser",
    cadenceMinutes: 60,
    enabled: false,
    priority: "normal",
    tags: ["social", "public"],
  },
  {
    id: "market-news-watchlist",
    name: "Configured market/company sources",
    domain: "money",
    url: "https://example.invalid/market-watchlist",
    method: "api",
    cadenceMinutes: 60,
    enabled: false,
    priority: "normal",
    tags: ["markets", "news"],
  },
]
