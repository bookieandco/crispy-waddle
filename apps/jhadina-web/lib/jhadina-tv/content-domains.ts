export const JHADINA_TV_CONTENT_DOMAINS = [
  'live',
  'sports',
  'local',
  'movies',
  'shows',
  'news',
  'music',
] as const

export type JhadinaTVContentDomain = (typeof JHADINA_TV_CONTENT_DOMAINS)[number]

export interface ContentAvailabilityPolicy {
  domain: JhadinaTVContentDomain
  requiresProviderAuthorization: boolean
  supportsLivePlayback: boolean
  supportsOnDemand: boolean
}

export const CONTENT_AVAILABILITY_POLICIES: Record<JhadinaTVContentDomain, ContentAvailabilityPolicy> = {
  live: { domain: 'live', requiresProviderAuthorization: false, supportsLivePlayback: true, supportsOnDemand: false },
  sports: { domain: 'sports', requiresProviderAuthorization: true, supportsLivePlayback: true, supportsOnDemand: true },
  local: { domain: 'local', requiresProviderAuthorization: false, supportsLivePlayback: true, supportsOnDemand: true },
  movies: { domain: 'movies', requiresProviderAuthorization: true, supportsLivePlayback: false, supportsOnDemand: true },
  shows: { domain: 'shows', requiresProviderAuthorization: true, supportsLivePlayback: false, supportsOnDemand: true },
  news: { domain: 'news', requiresProviderAuthorization: false, supportsLivePlayback: true, supportsOnDemand: true },
  music: { domain: 'music', requiresProviderAuthorization: false, supportsLivePlayback: true, supportsOnDemand: true },
}
