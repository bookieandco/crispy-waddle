export type IntelligenceDomain =
  | "campaign"
  | "social"
  | "money"
  | "overage"
  | "general"

export type SourceKind = "official_api" | "public_web" | "authorized_connector" | "licensed_dataset"

export type CollectionRequest = {
  id: string
  url: string
  domain: IntelligenceDomain
  source: string
  kind: SourceKind
  priority: "low" | "normal" | "high" | "critical"
  reason: "scheduled" | "changed" | "manual" | "follow_up"
  metadata?: Record<string, string>
}

export type RawObservation = {
  source: string
  url: string
  capturedAt: string
  content: string
  contentHash: string
  metadata?: Record<string, unknown>
}

export type EvidenceItem = {
  id: string
  source: string
  url: string
  capturedAt: string
  domain: IntelligenceDomain
  title?: string
  summary: string
  contentHash: string
  confidence: "low" | "medium" | "high"
  provenance: {
    collector: string
    method: SourceKind
    originalUrl: string
  }
}

export type ChangeEvent = {
  id: string
  source: string
  url: string
  detectedAt: string
  domain: IntelligenceDomain
  changeType: "new" | "updated" | "removed" | "unknown"
  previousHash?: string
  currentHash: string
  evidenceId?: string
}

export interface SourceAdapter {
  readonly name: string
  readonly kinds: SourceKind[]
  supports(request: CollectionRequest): boolean
  collect(request: CollectionRequest): Promise<RawObservation[]>
}

export class CollectionRouter {
  constructor(private readonly adapters: SourceAdapter[]) {}

  async collect(request: CollectionRequest): Promise<RawObservation[]> {
    const adapter = this.adapters.find((candidate) =>
      candidate.supports(request),
    )

    if (!adapter) {
      throw new Error(`No source adapter available for ${request.source}`)
    }

    return adapter.collect(request)
  }
}
