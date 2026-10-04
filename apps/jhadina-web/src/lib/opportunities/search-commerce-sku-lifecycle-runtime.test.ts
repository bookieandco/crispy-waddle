import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Opportunity,
  OpportunityOutcome,
  SearchCommerceProductSniperCandidate,
  SearchCommerceProductSniperLearningSnapshot,
  SearchCommerceProductTruthSnapshot,
  VentureOpportunity,
} from '@jhadina/opportunity-core'
import {
  recordSearchCommerceSellerSettlementRuntime,
  recordSearchCommerceSkuPublicationRuntime,
  type SearchCommerceSkuLifecycleDependencies,
} from './search-commerce-sku-lifecycle-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  executionOwners: ['pupsonstuff', 'commerce'],
} as unknown as VentureOpportunity

const productTruth: SearchCommerceProductTruthSnapshot = {
  id: 'truth:ornament',
  ventureId: venture.id,
  opportunityId: venture.opportunityId,
  family: venture.family,
  candidateId: 'sniper:ornament',
  sourceOwner: 'pupsonstuff',
  productRef: 'product:ornament',
  productType: 'ornament',
  title: 'Original hometown ornament',
  targetChannels: ['etsy'],
  catalogStatus: 'active',
  listingRefs: [],
  creativeAssetRefs: ['asset:ornament'],
  providerRefs: ['printify:variant:1'],
  channelEligibility: [{
    channel: 'etsy',
    status: 'eligible',
    evidenceRefs: ['eligibility:etsy'],
  }],
  unitEconomics: { costCompleteness: 'none' },
  fulfillment: {
    certification: 'sample_verified',
    productionLeadDays: 4,
    evidenceRefs: ['fulfillment:sample'],
  },
  policy: { status: 'reviewed', evidenceRefs: ['policy:etsy'] },
  risk: {},
  observedAt: '2026-10-04T10:00:00.000Z',
  evidenceRefs: ['truth:evidence'],
  authority: 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY',
  sourceAuthorityRetained: true,
  externalActionAuthorized: false,
  publishingAuthorized: false,
  purchasingAuthorized: false,
  moneyMovementAuthorized: false,
}

const candidate = {
  id: 'sniper:ornament',
  ventureId: venture.id,
  family: venture.family,
  title: 'Original hometown ornament',
  productType: 'ornament',
  buyer: 'gift buyer',
  marketMechanic: 'hometown identity gift',
  originalConcept: 'Original hometown ornament',
  targetChannels: ['etsy'],
  baseScore: 80,
  realizedLearningAdjustment: 0,
  score: 80,
  factors: {
    demand: 80,
    buyerIntent: 80,
    competitionHeadroom: 80,
    marginPotential: 80,
    differentiation: 80,
    channelFit: 80,
    automationPotential: 80,
    repeatability: 80,
    seasonalFit: 100,
    evidenceQuality: 80,
    platformSafety: 80,
    fulfillmentEase: 80,
    capitalEfficiency: 80,
  },
  recommendation: 'research',
  blockers: [],
  reasons: [],
  signalIds: ['signal:1'],
  evidenceRefs: ['candidate:evidence'],
  originality: {
    decision: 'pass',
    reasons: ['original'],
    evidenceRefs: ['originality:evidence'],
    directReplicationAuthorized: false,
    competitorAssetReuseAuthorized: false,
  },
  evaluatedAt: '2026-10-04T10:30:00.000Z',
  authority: 'PRODUCT_SNIPER_RESEARCH_ONLY',
  externalActionAuthorized: false,
  publishingAuthorized: false,
  purchasingAuthorized: false,
  moneyMovementAuthorized: false,
  directCreativeReplicationAuthorized: false,
} as SearchCommerceProductSniperCandidate

const canonical = {
  id: venture.opportunityId,
  status: 'ready',
} as unknown as Opportunity

function dependencies() {
  const receipts: Array<{
    id: string
    ownerUserId: string
    ventureId?: string
    kind: string
    evidenceRefs: string[]
    payload: Record<string, unknown>
    recordedAt: string
  }> = [{
    id: 'truth-receipt',
    ownerUserId: 'owner-1',
    ventureId: venture.id,
    kind: 'product_truth',
    evidenceRefs: [...productTruth.evidenceRefs],
    payload: { snapshot: productTruth },
    recordedAt: productTruth.observedAt,
  }, {
    id: 'sniper-receipt',
    ownerUserId: 'owner-1',
    ventureId: venture.id,
    kind: 'product_sniper',
    evidenceRefs: [...candidate.evidenceRefs],
    payload: {
      report: {
        ventureId: venture.id,
        family: venture.family,
        evaluatedAt: candidate.evaluatedAt,
        candidates: [candidate],
        researchQueue: [candidate],
        holdQueue: [],
        rejected: [],
        evidenceRefs: candidate.evidenceRefs,
        authority: 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY',
        externalActionAuthorized: false,
        publishingAuthorized: false,
        purchasingAuthorized: false,
        moneyMovementAuthorized: false,
      },
    },
    recordedAt: candidate.evaluatedAt,
  }]
  const outcomes: OpportunityOutcome[] = []
  const learning: SearchCommerceProductSniperLearningSnapshot[] = []

  const deps: SearchCommerceSkuLifecycleDependencies = {
    ventures: {
      async getVentureByOpportunity() {
        return venture
      },
      async listReceipts(_owner, kind) {
        return receipts.filter((receipt) => receipt.kind === kind) as never
      },
      async recordReceipt(receipt) {
        const index = receipts.findIndex((item) => item.id === receipt.id)
        if (index >= 0) receipts[index] = receipt
        else receipts.push(receipt)
        return receipt
      },
    },
    async getCanonicalOpportunity() {
      return canonical
    },
    async recordTrustedOutcome({ settlement }) {
      const outcome = {
        id: 'seller-settlement-outcome:' + settlement.id,
        opportunityId: venture.opportunityId,
        result: 'won',
        currency: settlement.currency,
        grossRevenue: settlement.grossRevenue,
        refunds: settlement.refunds,
        directCosts: settlement.productCosts + settlement.shippingCosts + settlement.providerCosts + settlement.otherDirectCosts,
        fees: settlement.fees,
        hours: settlement.hours,
        sourceOwner: 'commerce',
        evidenceRefs: [...settlement.evidenceRefs],
        transactionRefs: [...settlement.transactionRefs],
        executionRef: settlement.settlementRef,
        observedAt: settlement.observedAt,
        netRevenue: settlement.grossRevenue - settlement.refunds,
        totalCosts: settlement.productCosts + settlement.shippingCosts + settlement.providerCosts + settlement.otherDirectCosts + settlement.fees,
        profit: settlement.grossRevenue - settlement.refunds - settlement.productCosts - settlement.shippingCosts - settlement.providerCosts - settlement.otherDirectCosts - settlement.fees,
        margin: 0.4,
        dollarsPerHour: 40,
      } as OpportunityOutcome
      outcomes.push(outcome)
      return outcome
    },
    async recordProductLearning() {
      const snapshot = {
        ventureId: venture.id,
        opportunityId: venture.opportunityId,
        family: venture.family,
        candidateId: candidate.id,
        productType: candidate.productType,
        marketMechanic: candidate.marketMechanic,
        targetChannels: candidate.targetChannels,
        observationCount: 1,
        wins: 1,
        losses: 0,
        grossRevenue: 100,
        refunds: 0,
        totalCosts: 60,
        profit: 40,
        realizedMargin: 0.4,
        averageDollarsPerHour: 40,
        refundRate: 0,
        experimentPromotes: 0,
        experimentHolds: 0,
        experimentKills: 0,
        confidence: 0.3,
        scoreAdjustment: 0,
        decision: 'insufficient_evidence',
        evidenceRefs: ['learning:evidence'],
        transactionRefs: ['transaction:1'],
        observedThrough: '2026-10-04T13:00:00.000Z',
        authority: 'PRODUCT_SNIPER_REALIZED_LEARNING_ONLY',
        externalActionAuthorized: false,
        publishingAuthorized: false,
        purchasingAuthorized: false,
        moneyMovementAuthorized: false,
      } as SearchCommerceProductSniperLearningSnapshot
      learning.push(snapshot)
      return snapshot
    },
  }
  return { deps, receipts, outcomes, learning }
}

describe('Search Commerce SKU lifecycle runtime', () => {
  it('requires Product Truth QC before accepting a published SKU receipt', async () => {
    const { deps, receipts } = dependencies()
    const receipt = await recordSearchCommerceSkuPublicationRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        publication: {
          id: 'etsy:listing:123',
          candidateId: candidate.id,
          productTruthId: productTruth.id,
          sourceOwner: 'commerce',
          productRef: productTruth.productRef,
          skuRef: 'sku:ornament',
          channel: 'etsy',
          externalListingId: '123',
          listingUrl: 'https://www.etsy.com/listing/123',
          state: 'published',
          governanceRefs: ['approval:sku:123'],
          observedAt: '2026-10-04T12:00:00.000Z',
          evidenceRefs: ['provider:etsy:listing:123'],
        },
        dependencies: deps,
      },
    )
    expect(receipt.state).toBe('published')
    expect(receipt.publishingAuthorized).toBe(false)
    expect(receipts.some((item) => item.kind === 'sku_publication')).toBe(true)
  })

  it('turns a complete settled SKU into trusted outcome plus Product Sniper learning', async () => {
    const { deps, outcomes, learning } = dependencies()
    await recordSearchCommerceSkuPublicationRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        publication: {
          id: 'etsy:listing:123',
          candidateId: candidate.id,
          productTruthId: productTruth.id,
          sourceOwner: 'commerce',
          productRef: productTruth.productRef,
          skuRef: 'sku:ornament',
          channel: 'etsy',
          externalListingId: '123',
          state: 'published',
          governanceRefs: ['approval:sku:123'],
          observedAt: '2026-10-04T12:00:00.000Z',
          evidenceRefs: ['provider:etsy:listing:123'],
        },
        dependencies: deps,
      },
    )

    const result = await recordSearchCommerceSellerSettlementRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        settlement: {
          id: 'etsy:settlement:1',
          sourceOwner: 'commerce',
          provider: 'etsy',
          accountRef: 'shop:1',
          settlementRef: 'settlement:1',
          scope: 'sku',
          candidateId: candidate.id,
          productRef: productTruth.productRef,
          skuRef: 'sku:ornament',
          currency: 'USD',
          grossRevenue: 100,
          refunds: 0,
          productCosts: 25,
          shippingCosts: 10,
          providerCosts: 5,
          otherDirectCosts: 0,
          fees: 10,
          hours: 1,
          costBasisComplete: true,
          state: 'settled',
          transactionRefs: ['transaction:1'],
          observedAt: '2026-10-04T13:00:00.000Z',
          evidenceRefs: ['provider:settlement:1'],
        },
        dependencies: deps,
      },
    )

    expect(result.outcomeRecorded).toBe(true)
    expect(result.learningRecorded).toBe(true)
    expect(result.blockers).toEqual([])
    expect(outcomes).toHaveLength(1)
    expect(learning).toHaveLength(1)
  })

  it('records partial settlement truth but refuses to manufacture an outcome', async () => {
    const { deps, outcomes, learning } = dependencies()
    const result = await recordSearchCommerceSellerSettlementRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        settlement: {
          id: 'etsy:settlement:partial',
          sourceOwner: 'commerce',
          provider: 'etsy',
          accountRef: 'shop:1',
          settlementRef: 'settlement:partial',
          scope: 'sku',
          candidateId: candidate.id,
          productRef: productTruth.productRef,
          skuRef: 'sku:ornament',
          currency: 'USD',
          grossRevenue: 100,
          refunds: 0,
          productCosts: 25,
          shippingCosts: 0,
          providerCosts: 0,
          otherDirectCosts: 0,
          fees: 0,
          hours: 0,
          costBasisComplete: false,
          state: 'settled',
          transactionRefs: ['transaction:partial'],
          observedAt: '2026-10-04T13:00:00.000Z',
          evidenceRefs: ['provider:settlement:partial'],
        },
        dependencies: deps,
      },
    )

    expect(result.outcomeRecorded).toBe(false)
    expect(result.learningRecorded).toBe(false)
    expect(result.blockers).toContain('seller_settlement_cost_basis_incomplete')
    expect(outcomes).toHaveLength(0)
    expect(learning).toHaveLength(0)
  })
})
