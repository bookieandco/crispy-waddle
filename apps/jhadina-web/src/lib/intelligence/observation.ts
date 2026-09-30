export type RawObservation = {
  id: string
  sourceId: string
  url: string
  capturedAt: string
  content: string
  contentHash: string
  collector: string
  status: "new" | "updated" | "unchanged" | "failed"
  metadata?: Record<string, string | number | boolean>
}

export type ChangeEvent = {
  id: string
  sourceId: string
  observationId: string
  detectedAt: string
  kind: "new" | "updated" | "removed" | "unknown"
  previousHash?: string
  currentHash?: string
  evidenceId?: string
}

export type CollectionFailure = {
  sourceId: string
  failedAt: string
  attempt: number
  errorClass: "rate_limit" | "timeout" | "unauthorized" | "blocked" | "network" | "parse" | "unknown"
  retryable: boolean
}

/** A source adapter should return observations; it must not directly mutate OS state. */
export interface SourceAdapter {
  readonly name: string
  readonly supportedMethods: string[]
  collect(input: { sourceId: string; url: string }): Promise<RawObservation[]>
}
