export const CATALOG_TYPES = ['movie', 'show', 'episode', 'live-channel', 'live-event', 'sports', 'news', 'music', 'documentary'] as const
export type CatalogType = (typeof CATALOG_TYPES)[number]

export interface CatalogItem {
  id: string
  title: string
  normalizedTitle: string
  type: CatalogType
  genres: string[]
  description?: string
  year?: number
  languages: string[]
  captionLanguages: string[]
  region?: string
  sourceIds: string[]
  includedSourceIds: string[]
  live: boolean
  updatedAt: string
}

export interface CatalogQuery {
  text?: string
  type?: CatalogType
  genres?: string[]
  language?: string
  captionLanguage?: string
  sourceId?: string
  region?: string
  liveOnly?: boolean
}

export interface CatalogIndex {
  items: CatalogItem[]
  byId: Map<string, CatalogItem>
}

export function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ')
}

export function buildCatalog(items: CatalogItem[]): CatalogIndex {
  const deduped = new Map<string, CatalogItem>()
  for (const item of items) {
    const key = `${item.type}:${normalizeTitle(item.title)}:${item.year ?? ''}`
    const existing = deduped.get(key)
    if (!existing) deduped.set(key, { ...item, normalizedTitle: normalizeTitle(item.title) })
    else deduped.set(key, {
      ...existing,
      sourceIds: [...new Set([...existing.sourceIds, ...item.sourceIds])],
      includedSourceIds: [...new Set([...existing.includedSourceIds, ...item.includedSourceIds])],
      genres: [...new Set([...existing.genres, ...item.genres])],
      languages: [...new Set([...existing.languages, ...item.languages])],
      captionLanguages: [...new Set([...existing.captionLanguages, ...item.captionLanguages])],
      live: existing.live || item.live,
      updatedAt: existing.updatedAt > item.updatedAt ? existing.updatedAt : item.updatedAt,
    })
  }
  const result = [...deduped.values()]
  return { items: result, byId: new Map(result.map((item) => [item.id, item])) }
}

export function searchCatalog(index: CatalogIndex, query: CatalogQuery = {}): CatalogItem[] {
  const text = query.text ? normalizeTitle(query.text) : ''
  const terms = text.split(' ').filter(Boolean)
  return index.items
    .filter((item) => !query.type || item.type === query.type)
    .filter((item) => !query.region || !item.region || item.region === query.region)
    .filter((item) => !query.sourceId || item.sourceIds.includes(query.sourceId))
    .filter((item) => !query.language || item.languages.includes(query.language))
    .filter((item) => !query.captionLanguage || item.captionLanguages.includes(query.captionLanguage))
    .filter((item) => !query.liveOnly || item.live)
    .filter((item) => !query.genres?.length || query.genres.every((genre) => item.genres.includes(genre)))
    .filter((item) => !terms.length || terms.every((term) => item.normalizedTitle.includes(term) || item.genres.some((genre) => normalizeTitle(genre).includes(term))))
    .sort((a, b) => {
      const aExact = text && a.normalizedTitle === text ? 1 : 0
      const bExact = text && b.normalizedTitle === text ? 1 : 0
      return bExact - aExact || b.updatedAt.localeCompare(a.updatedAt)
    })
}
