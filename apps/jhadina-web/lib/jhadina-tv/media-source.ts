export interface AuthorizedMediaSource {
  id: string
  url: string
  title: string
  sourceId: string
  authorization: 'public' | 'official' | 'user-owned'
  mediaType: 'live' | 'movie' | 'show' | 'sports' | 'local'
  region?: string
  expiresAt?: string
}

export function isPlayableSource(source: AuthorizedMediaSource, now = new Date()): boolean {
  if (!source.url || !source.title) return false
  if (source.expiresAt && new Date(source.expiresAt).getTime() <= now.getTime()) return false
  return source.authorization !== undefined
}

export function selectPlayableSource(
  sources: AuthorizedMediaSource[],
  mediaType: AuthorizedMediaSource['mediaType'],
  region?: string,
): AuthorizedMediaSource | undefined {
  return sources
    .filter((source) => source.mediaType === mediaType)
    .filter((source) => !region || !source.region || source.region === region)
    .filter((source) => isPlayableSource(source))
    .sort((a, b) => Number(b.authorization === 'official') - Number(a.authorization === 'official'))[0]
}
