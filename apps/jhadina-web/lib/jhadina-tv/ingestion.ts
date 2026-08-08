import type { AuthorizedMediaSource } from './media-source'
import type { TVSource } from './types'

export interface IngestionResult {
  sourceId: string
  items: AuthorizedMediaSource[]
  fetchedAt: string
}

export interface SourceIngestionAdapter {
  readonly sourceId: string
  ingest(): Promise<IngestionResult>
}

export function buildIngestionResult(source: TVSource, items: AuthorizedMediaSource[], now = new Date()): IngestionResult {
  return { sourceId: source.id, items, fetchedAt: now.toISOString() }
}
