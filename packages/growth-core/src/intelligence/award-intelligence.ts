export interface AwardRecord {
  id: string
  agency?: string
  awardee: string
  naics?: string
  psc?: string
  placeOfPerformance?: string
  amount: number
  signedDate?: string
  solicitationId?: string
  setAside?: string
  sourceUrl: string
}

export interface PrimeProfile {
  awardee: string
  awardCount: number
  totalAwardValue: number
  relevantAwardCount: number
  recentAwardCount: number
  agencies: string[]
  naics: string[]
  likelyPrime: boolean
  confidence: number
}

export interface PrimeDiscoveryQuery {
  naics?: string
  psc?: string
  agency?: string
  placeOfPerformance?: string
  minAwardValue?: number
  since?: string
}

export interface PrimeOpportunitySignal {
  awardee: string
  relevanceScore: number
  estimatedPrimeValue: number
  reason: string
}

/**
 * Decision-support only. Uses public award records to identify likely primes
 * worth researching for teaming/subcontracting opportunities. It never bids,
 * contacts vendors, represents a company, or commits funds.
 */
export function buildPrimeProfiles(
  awards: readonly AwardRecord[],
  query: PrimeDiscoveryQuery = {},
): PrimeProfile[] {
  const filtered = awards.filter((award) => matchesQuery(award, query))
  const groups = new Map<string, AwardRecord[]>()

  for (const award of filtered) {
    const current = groups.get(award.awardee) ?? []
    current.push(award)
    groups.set(award.awardee, current)
  }

  return [...groups.entries()]
    .map(([awardee, records]) => {
      const recent = records.filter((r) => query.since && r.signedDate ? r.signedDate >= query.since : true)
      return {
        awardee,
        awardCount: records.length,
        totalAwardValue: records.reduce((sum, r) => sum + Math.max(r.amount, 0), 0),
        relevantAwardCount: records.length,
        recentAwardCount: recent.length,
        agencies: unique(records.map((r) => r.agency).filter(Boolean) as string[]),
        naics: unique(records.map((r) => r.naics).filter(Boolean) as string[]),
        likelyPrime: records.length >= 2,
        confidence: Math.min(100, 35 + records.length * 10 + (records.some((r) => r.amount >= 100000) ? 20 : 0)),
      }
    })
    .sort((a, b) => b.totalAwardValue - a.totalAwardValue)
}

export function rankPrimeSignals(profiles: readonly PrimeProfile[]): PrimeOpportunitySignal[] {
  return profiles
    .map((profile) => {
      const relevanceScore = Math.min(100,
        profile.confidence * 0.45 +
        Math.min(profile.awardCount * 8, 25) +
        Math.min(profile.totalAwardValue / 1000000 * 20, 20) +
        (profile.recentAwardCount > 0 ? 10 : 0),
      )
      return {
        awardee: profile.awardee,
        relevanceScore,
        estimatedPrimeValue: profile.totalAwardValue,
        reason: `${profile.awardCount} relevant award(s), $${Math.round(profile.totalAwardValue).toLocaleString()} total value, across ${profile.agencies.length || 1} agency/agency group(s). Research as a potential prime/teaming target.`,
      }
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

function matchesQuery(award: AwardRecord, query: PrimeDiscoveryQuery): boolean {
  if (query.naics && award.naics !== query.naics) return false
  if (query.psc && award.psc !== query.psc) return false
  if (query.agency && award.agency !== query.agency) return false
  if (query.placeOfPerformance && award.placeOfPerformance !== query.placeOfPerformance) return false
  if (query.minAwardValue !== undefined && award.amount < query.minAwardValue) return false
  if (query.since && award.signedDate && award.signedDate < query.since) return false
  return true
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
