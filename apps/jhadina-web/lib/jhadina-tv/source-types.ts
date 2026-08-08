export const JHADINA_TV_SOURCE_TYPES = [
  'public-iptv',
  'local-broadcast',
  'fast',
  'official-youtube',
  'sports-provider',
  'cable-provider',
  'streaming-provider',
  'user-owned',
  'metadata',
] as const

export type JhadinaTVSourceType = (typeof JHADINA_TV_SOURCE_TYPES)[number]

export interface JhadinaTVSourceCapability {
  type: JhadinaTVSourceType
  authorized: boolean
  live: boolean
  onDemand: boolean
  epg: boolean
  geographicScope?: 'global' | 'country' | 'region' | 'local'
}
