import { describe, expect, it } from 'vitest'
import type { GrowthSideHustleFactoryInput } from '@jhadina/growth-core'
import type { StoredCanonicalOpportunity } from './canonical'
import {
  ingestGrowthSideHustleOpportunity,
  type GrowthSideHustleOpportunityRepository,
} from './growth-side-hustle-runtime'

const input: GrowthSideHustleFactoryInput = {
  providerId: 'provider:growth-affiliate',
  externalId: 'affiliate-runtime-1',
  sourceUrl: 'https://example.com/affiliate/runtime',
  sourceName: 'Example affiliate source',
  family: 'commerce_affiliate',
  distribution: {
    id: 'distribution-opportunity:runtime',
    surfaceId: 'surface:youtube',
    title: 'Long-form product story',
    rationale: 'Evidence-backed format with clear buyer intent.',
    score: 78,
    reach: 75,
    audienceFit: 82,
    intent: 80,
    trend: 74,
    competition: 50,
    costEfficiency: 76,
    conversionPotential: 70,
    evidenceSignalIds: ['growth-signal:runtime'],
    recommendedAction: 'test',
  },
  scoreFactors: {
    demand: 80,
    pain: 75,
    abilityToPay: 70,
    distributionAccess: 80,
    domainAdvantage: 75,
    margin: 70,
    recurrence: 60,
    automationPotential: 80,
    reusableIp: 75,
    productizationPotential: 75,
    evidence: 78,
    processMaturity: 50,
    knowledgeAvailability: 75,
    adoptionFeasibility: 75,
    roiObservability: 80,
    timeToEvidence: 30,
    customerAcquisitionCost: 45,
    humanAttention: 35,
    capitalRisk: 20,
    competition: 50,
    regulation: 15,
    platformDependency: 50,
    failureCost: 20,
    fulfillmentComplexity: 15,
  },
  monetization: {
    id: 'offer:runtime',
    name: 'Affiliate runtime offer',
    state: 'observed',
    evidenceQuality: 80,
    evidenceRefs: ['affiliate-evidence:runtime'],
  },
  capturedAt: '2026-09-27T16:15:00.000Z',
}

describe('Growth Side Hustle Opportunity runtime', () => {
  it('persists the factory result through the canonical repository and returns a review-only experiment proposal', async () => {
    let persistedUserId = ''
    let persistedOpportunityId = ''

    const repository: GrowthSideHustleOpportunityRepository = {
      async upsert(userId, opportunity): Promise<StoredCanonicalOpportunity> {
        persistedUserId = userId
        persistedOpportunityId = opportunity.id
        return {
          userId,
          opportunity,
          triageState: 'review',
        }
      },
    }

    const result = await ingestGrowthSideHustleOpportunity(
      'user:factory-test',
      input,
      repository,
    )

    expect(persistedUserId).toBe('user:factory-test')
    expect(persistedOpportunityId).toBe(result.opportunity.id)
    expect(result.stored.opportunity.id).toBe(result.opportunity.id)
    expect(result.experimentProposal.requiresReview).toBe(true)
    expect(result.authority).toBe('OPPORTUNITY_ONLY')
  })

  it('rejects an empty user binding before persistence', async () => {
    const repository: GrowthSideHustleOpportunityRepository = {
      async upsert() {
        throw new Error('repository should not be called')
      },
    }

    await expect(
      ingestGrowthSideHustleOpportunity('   ', input, repository),
    ).rejects.toThrow(/userId is required/)
  })
})
