export type SpatialPolicyDisposition = 'allowed' | 'restricted' | 'unknown'

export type SpatialPrivacyClass = 'public-non-personal' | 'public-incidental-personal' | 'sensitive-public' | 'unknown'

export type SpatialUsePurpose =
  | 'private-analysis'
  | 'commercial-analysis'
  | 'publication'
  | 'model-input'
  | 'replay'
  | 'redistribution'

export type SpatialSourcePolicy = {
  sourceId: string
  provider: string
  domains: string[]
  attribution: string
  termsRef: string
  privacyClass: SpatialPrivacyClass
  commercialUse: SpatialPolicyDisposition
  publication: SpatialPolicyDisposition
  modelInput: SpatialPolicyDisposition
  replay: SpatialPolicyDisposition
  redistribution: SpatialPolicyDisposition
  retention: SpatialPolicyDisposition
  sourceIndependenceKey: string
  limitations: string[]
}

export type SpatialPolicyDecision = {
  allowed: boolean
  disposition: SpatialPolicyDisposition
  reason: string
  policy: SpatialSourcePolicy
}

const purposeField = (purpose: SpatialUsePurpose): keyof Pick<SpatialSourcePolicy, 'commercialUse' | 'publication' | 'modelInput' | 'replay' | 'redistribution'> | null => {
  if (purpose === 'commercial-analysis') return 'commercialUse'
  if (purpose === 'publication') return 'publication'
  if (purpose === 'model-input') return 'modelInput'
  if (purpose === 'replay') return 'replay'
  if (purpose === 'redistribution') return 'redistribution'
  return null
}

export class SpatialSourcePolicyRegistry {
  private readonly policies = new Map<string, SpatialSourcePolicy>()

  constructor(policies: readonly SpatialSourcePolicy[] = []) {
    for (const policy of policies) this.register(policy)
  }

  register(policy: SpatialSourcePolicy): void {
    if (!policy.sourceId || !policy.provider || !policy.attribution || !policy.termsRef || !policy.sourceIndependenceKey) {
      throw new Error('SPATIAL_SOURCE_POLICY_INVALID')
    }
    this.policies.set(policy.sourceId, {
      ...policy,
      domains: [...new Set(policy.domains)].sort(),
      limitations: [...policy.limitations],
    })
  }

  get(sourceId: string): SpatialSourcePolicy | undefined {
    const policy = this.policies.get(sourceId)
    return policy ? { ...policy, domains: [...policy.domains], limitations: [...policy.limitations] } : undefined
  }

  require(sourceId: string): SpatialSourcePolicy {
    const policy = this.get(sourceId)
    if (!policy) throw new Error(`SPATIAL_SOURCE_POLICY_MISSING:${sourceId}`)
    return policy
  }

  decide(sourceId: string, purpose: SpatialUsePurpose): SpatialPolicyDecision {
    const policy = this.require(sourceId)
    if (purpose === 'private-analysis') {
      return { allowed: true, disposition: 'allowed', reason: 'Private read-only analysis is permitted by Jhadina policy; provider terms still apply.', policy }
    }
    const field = purposeField(purpose)
    if (!field) return { allowed: false, disposition: 'unknown', reason: 'Purpose is not classified.', policy }
    const disposition = policy[field]
    return {
      allowed: disposition === 'allowed',
      disposition,
      reason: disposition === 'allowed'
        ? `${purpose} is permitted by the registered source policy.`
        : `${purpose} is ${disposition}; fail closed until provider terms explicitly permit it.`,
      policy,
    }
  }

  list(): SpatialSourcePolicy[] {
    return [...this.policies.values()].map((policy) => ({ ...policy, domains: [...policy.domains], limitations: [...policy.limitations] }))
  }
}

/**
 * Conservative policies derived from GEV's own DATA_SOURCES.md / LICENSE.
 * Unknown or provider-specific rights fail closed for commercial/publication/replay uses.
 */
export const GEV_SOURCE_POLICIES: readonly SpatialSourcePolicy[] = [
  {
    sourceId: 'gev-cctv', provider: 'gods-eye-view', domains: ['camera'],
    attribution: 'Per-camera provider attribution required', termsRef: 'GEV DATA_SOURCES.md: public CCTV providers',
    privacyClass: 'public-incidental-personal', commercialUse: 'unknown', publication: 'unknown', modelInput: 'restricted', replay: 'unknown', redistribution: 'restricted', retention: 'restricted',
    sourceIndependenceKey: 'gev:cctv', limitations: ['Frames may contain people, vehicles or plates.', 'Per-camera provider terms control reuse.', 'No named-person search, face recognition, individual tracking or plate identification.'],
  },
  {
    sourceId: 'gev-opensky', provider: 'OpenSky Network', domains: ['aircraft'],
    attribution: 'OpenSky Network / Schäfer et al.', termsRef: 'GEV DATA_SOURCES.md: OpenSky Network',
    privacyClass: 'public-non-personal', commercialUse: 'restricted', publication: 'unknown', modelInput: 'unknown', replay: 'unknown', redistribution: 'unknown', retention: 'unknown',
    sourceIndependenceKey: 'opensky', limitations: ['GEV documents OpenSky as non-commercial and notes operational deployments may require an agreement.'],
  },
  {
    sourceId: 'gev-adsblol', provider: 'adsb.lol', domains: ['aircraft'],
    attribution: 'adsb.lol contributors', termsRef: 'GEV DATA_SOURCES.md: adsb.lol',
    privacyClass: 'public-non-personal', commercialUse: 'allowed', publication: 'allowed', modelInput: 'allowed', replay: 'unknown', redistribution: 'restricted', retention: 'unknown',
    sourceIndependenceKey: 'adsb.lol', limitations: ['ODbL attribution/share-alike obligations apply to database use.'],
  },
  {
    sourceId: 'gev-aisstream', provider: 'AISStream', domains: ['vessel'],
    attribution: 'AISStream.io', termsRef: 'GEV DATA_SOURCES.md: AISStream.io',
    privacyClass: 'public-non-personal', commercialUse: 'unknown', publication: 'unknown', modelInput: 'unknown', replay: 'unknown', redistribution: 'unknown', retention: 'unknown',
    sourceIndependenceKey: 'aisstream', limitations: ['GEV notes the service is beta and has no formal ToS; rights beyond private analysis remain unknown.'],
  },
  {
    sourceId: 'gev-celestrak', provider: 'CelesTrak', domains: ['satellite'],
    attribution: 'CelesTrak / Dr. T.S. Kelso', termsRef: 'GEV DATA_SOURCES.md: CelesTrak',
    privacyClass: 'public-non-personal', commercialUse: 'unknown', publication: 'unknown', modelInput: 'unknown', replay: 'unknown', redistribution: 'unknown', retention: 'unknown',
    sourceIndependenceKey: 'celestrak', limitations: ['Respect CelesTrak fetch cadence and citation guidance.'],
  },
  {
    sourceId: 'gev-usgs', provider: 'USGS', domains: ['earthquake'],
    attribution: 'U.S. Geological Survey', termsRef: 'GEV DATA_SOURCES.md: USGS',
    privacyClass: 'public-non-personal', commercialUse: 'allowed', publication: 'allowed', modelInput: 'allowed', replay: 'allowed', redistribution: 'allowed', retention: 'allowed',
    sourceIndependenceKey: 'usgs', limitations: ['Preserve source and observation time.'],
  },
  {
    sourceId: 'gev-firms', provider: 'NASA FIRMS', domains: ['fire'],
    attribution: 'NASA FIRMS / NASA Earthdata', termsRef: 'GEV DATA_SOURCES.md: NASA FIRMS',
    privacyClass: 'public-non-personal', commercialUse: 'allowed', publication: 'allowed', modelInput: 'allowed', replay: 'allowed', redistribution: 'allowed', retention: 'allowed',
    sourceIndependenceKey: 'nasa-firms', limitations: ['Individual satellite detections are observations, not proof of ground conditions.', 'Preserve sensor/source identity when fusing detections.'],
  },
  {
    sourceId: 'gev-tomtom', provider: 'TomTom', domains: ['traffic'],
    attribution: 'Traffic flow data © TomTom', termsRef: 'GEV DATA_SOURCES.md: TomTom Traffic API',
    privacyClass: 'public-non-personal', commercialUse: 'unknown', publication: 'unknown', modelInput: 'unknown', replay: 'restricted', redistribution: 'restricted', retention: 'restricted',
    sourceIndependenceKey: 'tomtom', limitations: ['Provider terms, quotas and cache restrictions apply.'],
  },
  {
    sourceId: 'gev-osm', provider: 'OpenStreetMap contributors', domains: ['infrastructure', 'traffic', 'map'],
    attribution: '© OpenStreetMap contributors', termsRef: 'GEV DATA_SOURCES.md: OpenStreetMap / ODbL 1.0',
    privacyClass: 'public-non-personal', commercialUse: 'allowed', publication: 'allowed', modelInput: 'allowed', replay: 'allowed', redistribution: 'restricted', retention: 'allowed',
    sourceIndependenceKey: 'openstreetmap', limitations: ['ODbL attribution and database share-alike obligations apply where triggered.'],
  },
]

export const createGevSourcePolicyRegistry = (): SpatialSourcePolicyRegistry => new SpatialSourcePolicyRegistry(GEV_SOURCE_POLICIES)
