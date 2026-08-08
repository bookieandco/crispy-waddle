import { CONTENT_AVAILABILITY_POLICIES, type JhadinaTVContentDomain } from './content-domains'
import type { TVSource } from './types'

export interface SourceCandidate extends TVSource {
  region?: string
  authorized: boolean
  available: boolean
  priority: number
}

export interface ResolveRequest {
  domain: JhadinaTVContentDomain
  region?: string
  requiresLive?: boolean
  requiresOnDemand?: boolean
}

/** Pure resolver: ranks declared sources; it never bypasses provider authorization. */
export function resolveSources(request: ResolveRequest, sources: TVSource[]): SourceCandidate[] {
  const policy = CONTENT_AVAILABILITY_POLICIES[request.domain]

  return sources
    .filter((source) => source.enabled)
    .map((source) => ({
      ...source,
      authorized: !policy.requiresProviderAuthorization || source.provenance === 'official' || source.provenance === 'user-owned',
      available: request.requiresLive ? source.kind !== 'metadata' : true,
      region: request.region,
      priority: source.provenance === 'official' ? 100 : source.provenance === 'public' ? 70 : 50,
    }))
    .filter((source) => source.authorized && source.available)
    .sort((a, b) => b.priority - a.priority)
}
