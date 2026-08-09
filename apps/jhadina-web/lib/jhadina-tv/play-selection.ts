import type { CatalogItem } from './unified-catalog'
import { resolvePlayerSource } from './player-source'
import type { AuthorizedMediaSource } from './media-source'

export interface PlaybackSelection {
  item: CatalogItem
  source?: AuthorizedMediaSource
  error?: string
}

export function selectPlayback(item: CatalogItem, candidates: AuthorizedMediaSource[], region?: string): PlaybackSelection {
  const result = resolvePlayerSource(candidates, item.type === 'live-channel' ? 'live' : item.type === 'sports' || item.type === 'live-event' ? 'sports' : item.type === 'movie' ? 'movie' : 'show', region)
  return result.source ? { item, source: result.source } : { item, error: result.reason }
}
