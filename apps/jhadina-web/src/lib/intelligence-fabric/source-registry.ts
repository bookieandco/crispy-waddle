import type { IntelligenceDomain, SourceTransport } from "./contracts"

export type IntelligenceSource = {
  id: string
  name: string
  domains: IntelligenceDomain[]
  transports: SourceTransport[]
  cadence: "realtime" | "hourly" | "daily" | "on_change" | "manual"
  authority: "primary" | "secondary"
  enabled: boolean
  notes: string
}

/**
 * The fabric is source-agnostic. Firecrawl, Crawlee and Scrapling are
 * collection engines; changedetection.io is a change-detection engine.
 * They must not be treated as evidence themselves.
 */
export const INTELLIGENCE_SOURCES: IntelligenceSource[] = [
  {
    id: "web-firecrawl",
    name: "Firecrawl",
    domains: ["campaign", "social", "money", "overage", "general"],
    transports: ["public_web", "browser_crawl"],
    cadence: "on_change",
    authority: "secondary",
    enabled: true,
    notes: "Search, map, crawl and structured extraction adapter; provenance is retained from the underlying page.",
  },
  {
    id: "web-crawlee",
    name: "Crawlee",
    domains: ["campaign", "social", "money", "overage", "general"],
    transports: ["public_web", "browser_crawl"],
    cadence: "daily",
    authority: "secondary",
    enabled: true,
    notes: "Scalable crawler runtime for queues, retries, browser automation and domain-specific adapters.",
  },
  {
    id: "web-scrapling",
    name: "Scrapling",
    domains: ["campaign", "social", "money", "overage", "general"],
    transports: ["public_web", "browser_crawl"],
    cadence: "on_change",
    authority: "secondary",
    enabled: true,
    notes: "Adaptive parser/fetcher fallback for sites whose structure changes.",
  },
  {
    id: "web-changedetection",
    name: "changedetection.io",
    domains: ["campaign", "money", "overage", "general"],
    transports: ["change_monitor"],
    cadence: "on_change",
    authority: "secondary",
    enabled: true,
    notes: "Monitors known URLs and emits changes; change events are converted into evidence only after normalization.",
  },
]
