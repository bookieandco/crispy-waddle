import { describe, expect, it } from 'vitest'
import { INFORMATION_BROKER_BLUEPRINTS, buildInformationBrokerEvidencePolicy } from './information-broker-blueprint.js'

describe('information broker blueprints', () => {
  it('covers small-business funding and real-estate programs', () => {
    expect(INFORMATION_BROKER_BLUEPRINTS.map((item) => item.niche)).toEqual([
      'small_business_funding',
      'real_estate_programs',
    ])
  })

  it('requires primary or independently verified evidence', () => {
    const policy = buildInformationBrokerEvidencePolicy(INFORMATION_BROKER_BLUEPRINTS[0]!)
    expect(policy.sourceRequirement).toBe('primary_or_independently_verified')
    expect(policy.sellerClaimConfidenceCap).toBe(0.35)
    expect(policy.recheckAfterDays).toBe(7)
  })
})
