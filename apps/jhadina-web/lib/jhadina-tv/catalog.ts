import type { AuthorizedMediaSource } from './media-source'
import type { IngestionResult } from './ingestion'

/** Deterministic catalog merge/deduplication for normalized ingestion results. */
export function mergeIngestionResults(results: IngestionResult[]): AuthorizedMediaSource[] {
  const byKey = new Map<string, AuthorizedMediaSource>()

  for (const result of results) {
    for (const item of result.items) {
      const key = `${item.mediaType}:${item.id}`
      const existing = byKey.get(key)
      if (!existing || item.authorization === 'official' || !existing.url) byKey.set(key, item)
    }
  }

  return [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title))
}
