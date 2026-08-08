import type { CatalogItem, CatalogIndex } from './unified-catalog'
import { searchCatalog, normalizeTitle } from './unified-catalog'

export interface CatalogSection {
  id: string
  title: string
  items: CatalogItem[]
}

export function buildCatalogSections(index: CatalogIndex, region?: string): CatalogSection[] {
  const live = searchCatalog(index, { liveOnly: true, region }).slice(0, 10)
  const sports = searchCatalog(index, { type: 'sports', region }).slice(0, 10)
  const movies = searchCatalog(index, { type: 'movie', region }).slice(0, 10)
  const shows = searchCatalog(index, { type: 'show', region }).slice(0, 10)

  return [
    { id: 'continue', title: 'Continue Watching', items: [] },
    { id: 'live', title: 'Live Now', items: live },
    { id: 'sports', title: 'Sports', items: sports },
    { id: 'movies', title: 'Movies', items: movies },
    { id: 'shows', title: 'Shows', items: shows },
  ]
}

export function quickSearch(index: CatalogIndex, text: string, region?: string): CatalogItem[] {
  return searchCatalog(index, { text: normalizeTitle(text), region }).slice(0, 24)
}
