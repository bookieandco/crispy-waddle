import { describe, expect, it } from 'vitest'
import {
  buildVentureOpportunity,
  type Opportunity,
  type SideHustleExperiment,
} from '@jhadina/opportunity-core'
import { createVentureBoundedExperiment } from './venture-experiment-runtime'

const now = '2026-10-01T15:00:00.000Z'

function fixture() {
  const opportunity: Opportunity = {
    id: 'opportunity:test',
    title: 'Original personalized gift test',
    family: 'business',
    type: 'commercial',
    sourceUrl: 'https://example.test/opportunity',
    sourceName: 'Fixture',
    claims: [],
    evidence: [],
    verificationStatus: 'unverified',
    sourceConfidence: 0.8,
    riskFlags: [],
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  }
  const venture = buildVentureOpportunity({
    opportunity,
    family: 'pod_personalized_commerce',
    demandThesis: {
      buyer: 'Gift buyer',
      jobToBeDone: 'Buy a personal gift.',
      paidProblem: 'Generic gifts are impersonal.',
      marketMechanic: 'Personalization',
      unmetAngles: ['Neighborhood-specific personalization'],
      disconfirmingEvidence: [],
      evidenceRefs: ['evidence:demand'],
    },
    signals: [{
      id: 'signal:1',
      kind: 'search',
      sourceRef: 'https://example.test/signal',
      observedAt: now,
      note: 'Observed demand',
      confidence: 0.8,
    }],
    scoreFactors: {
      demandProof: 85,
      grossMarginPotential: 80,
      automationPotential: 90,
      competitionHeadroom: 70,
      differentiation: 85,
      startupEfficiency: 90,
      timeToEvidence: 85,
      repeatability: 85,
      legalPlatformSafety: 95,
      crossJhadinaLeverage: 90,
    },
    makeSense: {
      coherence: 90,
      causalLogic: 90,
      chronology: 85,
      incentives: 90,
      baseRates: 80,
      contradictionHandling: 85,
      alternativesConsidered: 85,
      evidenceQuality: 85,
      notes: ['Coherent fixture'],
      evidenceRefs: ['evidence:mims'],
    },
    originalityInput: {
      marketMechanics: ['personalization'],
      competitorArtifactRefs: [],
      proposedCreative: 'Original neighborhood illustration system',
      evidenceRefs: ['evidence:originality'],
    },
    evidenceRefs: ['evidence:venture'],
    createdAt: now,
  })
  return {
    venture,
    opportunity: {
      ...opportunity,
      metadata: { sideHustleProfile: venture.profile, ventureId: venture.id },
    } satisfies Opportunity,
  }
}

describe('venture bounded experiment bridge', () => {
  it('persists a planned Side Hustle experiment and never starts it', async () => {
    const { venture, opportunity } = fixture()
    let saved: SideHustleExperiment | undefined
    const result = await createVentureBoundedExperiment({
      venture,
      opportunity,
      hypothesis: 'Gift buyers will pay for the original personalized offer.',
      targetCustomer: 'Gift buyer',
      offer: '$34 personalized gift',
      channel: 'Owned storefront validation page',
      maxSpend: 50,
      currency: 'USD',
      maxHours: 5,
      maxDurationDays: 10,
      minimumObservations: 2,
      successCriteria: [{
        id: 'paid_customer',
        metric: 'paid_customers',
        operator: 'gte',
        threshold: 1,
        aggregation: 'sum',
        unit: 'customers',
      }],
      killCriteria: [],
      evidenceRefs: ['experiment:plan'],
      createdAt: now,
    }, {
      async createSideHustleExperiment(experiment) {
        saved = experiment
        return experiment
      },
    })

    expect(saved).toBeDefined()
    expect(result.experiment.status).toBe('planned')
    expect(result.started).toBe(false)
    expect(result.proposal.requiresApproval).toBe(true)
    expect(result.authorizationEffect).toBe('NONE')
  })
})
