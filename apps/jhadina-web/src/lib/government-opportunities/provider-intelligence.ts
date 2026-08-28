export type ProviderSourceType = 'official_registry' | 'prime_directory' | 'government_vendor_directory' | 'award_history' | 'commercial_directory' | 'user' | 'other'

export type ProviderCapability = {
  code: string
  name: string
  naics?: string[]
  psc?: string[]
  keywords: string[]
  confidence: number
}

export type ProviderCredential = {
  type: 'license' | 'certification' | 'bond' | 'insurance' | 'socioeconomic' | 'registration'
  name: string
  issuer?: string
  jurisdiction?: string
  expiresAt?: string
  verified: boolean
  evidenceUrl?: string
}

export type GovernmentProvider = {
  id: string
  legalName: string
  dbaName?: string
  uei?: string
  website?: string
  geography: {
    country?: string
    state?: string
    county?: string
    localities?: string[]
    serviceRadiusMiles?: number
  }
  capabilities: ProviderCapability[]
  credentials: ProviderCredential[]
  sourceIds: string[]
  governmentExperience: {
    awardCount?: number
    totalAwardValue?: number
    agencies?: string[]
    primeContracts?: number
    subcontractSignals?: number
  }
  capacity?: {
    available?: boolean
    notes?: string
  }
  evidence: Array<{
    sourceId: string
    sourceType: ProviderSourceType
    sourceUrl: string
    capturedAt: string
    confidence: number
  }>
  verificationStatus: 'unverified' | 'partially_verified' | 'verified' | 'rejected'
  updatedAt: string
}

export type ProviderMatch = {
  providerId: string
  score: number
  reasons: string[]
  blockers: string[]
  structure: 'prime' | 'subcontract' | 'teaming' | 'supplier' | 'broker_review'
}

export type ProviderMatchInput = {
  requiredCapabilities: string[]
  requiredNaics?: string[]
  requiredPsc?: string[]
  country?: string
  state?: string
  county?: string
  locality?: string
  serviceRadiusMiles?: number
  requiredCredentials?: string[]
  providerCapacityRequired?: boolean
  preferredStructures?: ProviderMatch['structure'][]
}

const normalize = (value: string) => value.trim().toLowerCase()

export function matchGovernmentProviders(
  input: ProviderMatchInput,
  providers: GovernmentProvider[],
): ProviderMatch[] {
  return providers
    .map((provider): ProviderMatch => {
      const reasons: string[] = []
      const blockers: string[] = []
      let score = 0

      const capabilities = provider.capabilities.map((capability) => ({
        ...capability,
        tokens: [capability.name, capability.code, ...capability.keywords].map(normalize),
      }))
      const required = input.requiredCapabilities.map(normalize)
      const matchedCapabilities = required.filter((requiredCapability) =>
        capabilities.some((capability) => capability.tokens.some((token) =>
          token.includes(requiredCapability) || requiredCapability.includes(token),
        )),
      )

      if (required.length > 0) {
        score += (matchedCapabilities.length / required.length) * 40
        if (matchedCapabilities.length === required.length) {
          reasons.push('All required capabilities matched')
        } else {
          blockers.push(`Missing ${required.length - matchedCapabilities.length} required capabilities`)
        }
      }

      if (input.requiredNaics?.length) {
        const providerNaics = provider.capabilities.flatMap((capability) => capability.naics ?? [])
        const matched = input.requiredNaics.some((code) => providerNaics.includes(code))
        if (matched) {
          score += 15
          reasons.push('NAICS capability matched')
        } else {
          blockers.push('No required NAICS match')
        }
      }

      if (input.requiredPsc?.length) {
        const providerPsc = provider.capabilities.flatMap((capability) => capability.psc ?? [])
        if (input.requiredPsc.some((code) => providerPsc.includes(code))) {
          score += 10
          reasons.push('PSC capability matched')
        } else {
          blockers.push('No required PSC match')
        }
      }

      const geographyMatches = [input.country, input.state, input.county, input.locality]
        .filter(Boolean)
        .every((location) => {
          const target = normalize(location!)
          return [
            provider.geography.country,
            provider.geography.state,
            provider.geography.county,
            ...(provider.geography.localities ?? []),
          ]
            .filter(Boolean)
            .map(normalize)
            .some((value) => value === target)
        })

      if (geographyMatches) {
        score += 15
        reasons.push('Geography matches the opportunity')
      } else if (input.state || input.county || input.locality) {
        blockers.push('Provider geography is not an exact match')
      }

      if (input.requiredCredentials?.length) {
        const credentials = provider.credentials.map((credential) => normalize(credential.name))
        const matchedCredentials = input.requiredCredentials.filter((credential) =>
          credentials.includes(normalize(credential)) &&
          provider.credentials.some((item) => normalize(item.name) === normalize(credential) && item.verified),
        )
        score += (matchedCredentials.length / input.requiredCredentials.length) * 15
        if (matchedCredentials.length !== input.requiredCredentials.length) {
          blockers.push('One or more required credentials are missing or unverified')
        } else {
          reasons.push('Required credentials verified')
        }
      }

      if (input.providerCapacityRequired) {
        if (provider.capacity?.available) {
          score += 5
          reasons.push('Provider reports available capacity')
        } else {
          blockers.push('Provider capacity is unknown or unavailable')
        }
      }

      if (provider.governmentExperience.awardCount && provider.governmentExperience.awardCount > 0) {
        score += 5
        reasons.push('Government performance history found')
      }

      if (provider.verificationStatus === 'rejected') {
        blockers.push('Provider is rejected')
      }

      return {
        providerId: provider.id,
        score: Math.round(Math.min(100, score)),
        reasons,
        blockers,
        structure: input.preferredStructures?.[0] ?? 'broker_review',
      }
    })
    .sort((a, b) => b.score - a.score)
}
