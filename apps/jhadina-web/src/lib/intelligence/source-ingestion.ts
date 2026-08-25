import type { IntelligenceDomain } from "./source-registry"

export type SourceObservationInput = {
  id: string
  sourceId: string
  domain: IntelligenceDomain
  title: string
  text: string
  url?: string
  publishedAt: string
  capturedAt: string
  confidence: number
  metadata?: Record<string, string | number | boolean | null>
}

export type NormalizedObservation = SourceObservationInput & {
  provenance: {
    sourceId: string
    capturedAt: string
    authoritative: boolean
  }
}

const AUTHORITATIVE_DOMAINS = new Set(["government", "official", "polling"])

/**
 * Shared ingestion boundary for polls, government records, news, social
 * collectors, market feeds, and other OS-specific sources. Adapters retain
 * their source-specific access logic; this layer only normalizes provenance.
 */
export function normalizeSourceObservation(
  input: SourceObservationInput,
): NormalizedObservation {
  return {
    ...input,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    provenance: {
      sourceId: input.sourceId,
      capturedAt: input.capturedAt,
      authoritative: AUTHORITATIVE_DOMAINS.has(input.domain),
    },
  }
}
