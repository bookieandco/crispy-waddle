import type { PollRecord } from "../campaign/polling"
import type { SourceObservationInput } from "./source-ingestion"

export type PollingObservation = SourceObservationInput & {
  metadata: {
    pollster: string
    geography: string
    sampleSize: number
    population: PollRecord["population"]
    marginOfError?: number
    candidate?: string
    support?: number
    fieldStart: string
    fieldEnd: string
  }
}

/**
 * Converts an existing CampaignOS poll into the shared intelligence format.
 * This adapter preserves the poll's methodological fields so downstream
 * synthesis can distinguish polling evidence from social or official data.
 */
export function pollToObservation(poll: PollRecord): PollingObservation {
  const candidateLabel = poll.candidate ? ` — ${poll.candidate}` : ""
  const supportLabel = typeof poll.support === "number" ? ` Support ${poll.support}%.` : ""

  return {
    id: `poll:${poll.id}`,
    sourceId: `pollster:${poll.pollster}`,
    domain: "polling",
    title: `${poll.pollster} poll${candidateLabel}`,
    text: `${poll.geography}; ${poll.population}; sample ${poll.sampleSize}.${supportLabel}`,
    url: poll.sourceUrl,
    publishedAt: poll.fieldEnd,
    capturedAt: new Date().toISOString(),
    confidence: poll.sampleSize > 1000 ? 0.85 : poll.sampleSize >= 400 ? 0.7 : 0.5,
    metadata: {
      pollster: poll.pollster,
      geography: poll.geography,
      sampleSize: poll.sampleSize,
      population: poll.population,
      marginOfError: poll.marginOfError ?? null,
      candidate: poll.candidate ?? null,
      support: poll.support ?? null,
      fieldStart: poll.fieldStart,
      fieldEnd: poll.fieldEnd,
    },
  }
}
