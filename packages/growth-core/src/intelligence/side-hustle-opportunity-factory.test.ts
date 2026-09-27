import { describe, expect, it } from 'vitest'
import type { SideHustleScoreFactors } from '@jhadina/opportunity-core'
import type { DistributionOpportunity } from './distribution-opportunity.js'
import { buildGrowthSideHustleOpportunity } from './side-hustle-opportunity-factory.js'

const distribution: DistributionOpportunity = {
  id: 'distribution-opportunity:wallet',
  surfaceId: 'surface:tiktok',
  title: 'Compact wallet problem/solution creative',
  rationale: 'Observed buyer intent and repeatable creative pattern.',
  score: 82,
  reach: 78,
  audienceFit: 88,
  intent: 84,
  trend: 86,
  competition: 45,
  costEfficiency: 80,
  conversionPotential: 72,
  evidenceSignalIds: ['growth-signal:tiktok:wallet'],
  recommendedAction: 'test',
}

function scoreFactors(): SideHustleScoreFactors {
  return {
    demand: 85,
    pain: 80,
    abilityToPay: 75,
    distributionAccess: 82,
    domainAdvantage: 78,
    margin: 72,
    recurrence: 60,
    automationPotential: 80,
    reusableIp: 70,
    productizationPotential: 78,
    evidence: 82,
    processMaturity: 55,
    knowledgeAvailability: 75,
    adoptionFeasibility: 80,
    roiObservability: 85,
    timeToEvidence: 25,
    customerAcquisitionCost: 40,
    humanAttention: 35,
    capitalRisk: 20,
    competition: 45,
    regulation: 15,
    platformDependency: 55,
    failureCost: 20,
    fulfillmentComplexity: 20,
  }
}

describe('Growth Side Hustle opportunity factory', () => {
  it('turns evidence-backed affiliate demand into a canonical bounded experiment candidate', () => {
    const result = buildGrowthSideHustleOpportunity({
      providerId: 'provider:growth-affiliate',
      externalId: 'wallet-2026-09',
      sourceUrl: 'https://example.com/affiliate/wallet',
      sourceName: 'Example affiliate network',
      family: 'commerce_affiliate',
      distribution,
      scoreFactors: scoreFactors(),
      monetization: {
        id: 'offer:wallet',
        name: 'Wallet affiliate offer',
        state: 'validated',
        evidenceQuality: 85,
        evidenceRefs: ['affiliate-evidence:wallet'],
        reportedRevenue: { min: 60, max: 90, currency: 'USD' },
      },
      targetCustomer: 'Men looking for a compact everyday wallet',
      capturedAt: '2026-09-27T16:00:00.000Z',
    })

    expect(result.authority).toBe('OPPORTUNITY_ONLY')
    expect(result.opportunity.type).toBe('commercial')
    expect(result.opportunity.metadata?.commercialKind).toBe('affiliate')
    expect(result.opportunity.metadata?.growthFactoryReadiness).toBe('experiment_candidate')
    expect(result.opportunity.metadata?.opportunityAuthority).toBe('OPPORTUNITY_ONLY')
    expect(result.opportunity.metadata?.sideHustleProfile).toMatchObject({
      family: 'commerce_affiliate',
      automationMaturity: 'unvalidated',
    })
    expect(result.experimentProposal.archetype).toBe('affiliate_conversion')
    expect(result.experimentProposal.requiresReview).toBe(true)
    expect(result.experimentProposal.evidenceRefs).toContain('growth-signal:tiktok:wallet')
    expect(result.experimentProposal.evidenceRefs).toContain('affiliate-evidence:wallet')
    expect(result.sideHustleScore.overall).toBeGreaterThan(60)
  })

  it('keeps hypothesis-only monetization in review instead of presenting it as ready', () => {
    const result = buildGrowthSideHustleOpportunity({
      providerId: 'provider:growth-affiliate',
      externalId: 'wallet-hypothesis',
      sourceUrl: 'https://example.com/affiliate/wallet',
      sourceName: 'Example affiliate network',
      family: 'commerce_affiliate',
      distribution,
      scoreFactors: scoreFactors(),
      monetization: {
        id: 'offer:wallet-hypothesis',
        name: 'Wallet affiliate hypothesis',
        state: 'hypothesis',
        evidenceQuality: 90,
        evidenceRefs: ['affiliate-evidence:hypothesis'],
      },
      capturedAt: '2026-09-27T16:00:00.000Z',
    })

    expect(result.opportunity.metadata?.growthFactoryReadiness).toBe('needs_review')
    expect(result.opportunity.riskFlags).toContain('monetization_hypothesis')
    expect(result.experimentProposal.requiresReview).toBe(true)
  })

  it('enforces the canonical provider registry instead of accepting a wrong execution lane', () => {
    expect(() => buildGrowthSideHustleOpportunity({
      providerId: 'provider:commerce-dropshipping',
      externalId: 'wrong-provider',
      sourceUrl: 'https://example.com/affiliate/wallet',
      sourceName: 'Example affiliate network',
      family: 'commerce_affiliate',
      distribution,
      scoreFactors: scoreFactors(),
      capturedAt: '2026-09-27T16:00:00.000Z',
    })).toThrow(/registered for dropshipping, not affiliate/)
  })

  it('does not turn Money-owned trading intelligence into a standalone side hustle business', () => {
    expect(() => buildGrowthSideHustleOpportunity({
      providerId: 'provider:services',
      externalId: 'trading-signal',
      sourceUrl: 'https://example.com/research',
      sourceName: 'Research source',
      family: 'trading_investing_intelligence',
      distribution,
      scoreFactors: scoreFactors(),
      capturedAt: '2026-09-27T16:00:00.000Z',
    })).toThrow(/Capability-only/)
  })
})
