export type IntelligenceDomain =
  | "campaign"
  | "social"
  | "money"
  | "overage"
  | "music"
  | "general"

export type SourceTransport =
  | "official_api"
  | "public_web"
  | "rss"
  | "change_monitor"
  | "browser_crawl"
  | "manual"

export type EvidenceItem = {
  id: string
  sourceId: string
  sourceUrl: string
  transport: SourceTransport
  domain: IntelligenceDomain
  observedAt: string
  publishedAt?: string
  title?: string
  summary: string
  contentHash?: string
  entities: string[]
  topics: string[]
  metrics?: Record<string, number | string>
  geography?: string
  confidence: "low" | "medium" | "high"
  provenance: "primary" | "secondary" | "derived"
}

export type ChangeEvent = {
  id: string
  sourceId: string
  url: string
  detectedAt: string
  previousHash?: string
  currentHash: string
  changedFields: string[]
  evidenceIds: string[]
}

export type IntelligenceSignal = {
  id: string
  domain: IntelligenceDomain
  type: "new" | "change" | "trend" | "anomaly" | "deadline" | "opportunity" | "risk"
  title: string
  summary: string
  evidenceIds: string[]
  confidence: "low" | "medium" | "high"
  priority: "low" | "medium" | "high" | "critical"
  requiresHumanReview: true
}

export type DailyLog = {
  id: string
  date: string
  generatedAt: string
  domains: IntelligenceDomain[]
  signals: IntelligenceSignal[]
  notableChanges: ChangeEvent[]
  sourceHealth: Record<string, "ok" | "degraded" | "blocked" | "stale">
  unresolvedQuestions: string[]
  recommendedNextSteps: string[]
}
