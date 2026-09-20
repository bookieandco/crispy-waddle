import { buildPrimeProfiles, rankPrimeSignals, type AwardRecord } from './award-intelligence'

describe('award intelligence', () => {
  const awards: AwardRecord[] = [
    { id: '1', awardee: 'Prime A', agency: 'Agency X', naics: '238220', amount: 500000, signedDate: '2026-08-01', sourceUrl: 'sam://1' },
    { id: '2', awardee: 'Prime A', agency: 'Agency X', naics: '238220', amount: 250000, signedDate: '2026-08-10', sourceUrl: 'sam://2' },
    { id: '3', awardee: 'Prime B', agency: 'Agency Y', naics: '238220', amount: 100000, signedDate: '2025-01-01', sourceUrl: 'sam://3' },
  ]

  it('groups and filters awards into prime profiles', () => {
    const profiles = buildPrimeProfiles(awards, { naics: '238220', since: '2026-01-01' })
    expect(profiles).toHaveLength(1)
    expect(profiles[0].awardee).toBe('Prime A')
    expect(profiles[0].totalAwardValue).toBe(750000)
    expect(profiles[0].likelyPrime).toBe(true)
  })

  it('ranks stronger prime signals first', () => {
    const profiles = buildPrimeProfiles(awards, { naics: '238220' })
    const signals = rankPrimeSignals(profiles)
    expect(signals[0].awardee).toBe('Prime A')
    expect(signals[0].estimatedPrimeValue).toBe(750000)
  })
})
