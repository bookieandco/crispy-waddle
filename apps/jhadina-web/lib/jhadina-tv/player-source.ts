import { getEnabledSources } from './source-registry'
import type { AuthorizedMediaSource } from './media-source'
import { isPlayableSource } from './media-source'

export interface PlayerSourceResult {
  source?: AuthorizedMediaSource
  sourceRegistryId?: string
  reason?: string
}

/** Connects the source registry to playback without inventing a URL. */
export function resolvePlayerSource(
  candidates: AuthorizedMediaSource[],
  mediaType: AuthorizedMediaSource['mediaType'],
  region?: string,
): PlayerSourceResult {
  const enabledIds = new Set(getEnabledSources().map((source) => source.id))
  const source = candidates
    .filter((candidate) => enabledIds.has(candidate.sourceId))
    .filter((candidate) => candidate.mediaType === mediaType)
    .filter((candidate) => !region || !candidate.region || candidate.region === region)
    .filter(isPlayableSource)
    .sort((a, b) => Number(b.authorization === 'official') - Number(a.authorization === 'official'))[0]

  return source
    ? { source, sourceRegistryId: source.sourceId }
    : { reason: 'No enabled, authorized, unexpired playback source is available.' }
}
