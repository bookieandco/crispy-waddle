import type { TVSource } from './types'

/** Initial source registry. Only provenance-aware sources belong here. */
export const jhadinaTVSources: TVSource[] = [
  {
    id: 'iptv-org',
    name: 'IPTV-Org public channels',
    kind: 'iptv',
    provenance: 'public',
    enabled: true,
  },
  {
    id: 'official-youtube',
    name: 'Official YouTube content',
    kind: 'youtube',
    provenance: 'official',
    enabled: true,
  },
  {
    id: 'tmdb',
    name: 'TMDB metadata',
    kind: 'metadata',
    provenance: 'public',
    enabled: true,
  },
]

export function getEnabledSources(): TVSource[] {
  return jhadinaTVSources.filter((source) => source.enabled)
}
