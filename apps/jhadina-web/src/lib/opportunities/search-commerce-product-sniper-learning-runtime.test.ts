import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OpportunityOutcome,
  VentureOpportunity,
} from '@jhadina/opportunity-core'
import {
  recordSearchCommerceProductSniperOutcomeLearning,
  type SearchCommerceProductSniperLearningDependencies,
} from './search-commerce-product-sniper-learning-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
} as unknown as VentureOpportunity

function outcome(id: string, day: number): OpportunityOutcome {
  return {
    id,
    opportunityId: venture.opportunityId,
    result: 'won',
    currency: 'USD',
    grossRevenue: 100,
    refunds: 0,
    directCosts: 55,
    fees: 0,
    hours: 1,
    sourceOwner: 'commerce',
    evidenceRefs: ['evidence:' + id],
    transactionRefs: ['transaction:' + id],
    observedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    netRevenue: 100,
    totalCosts: 55,
    profit: 45,
    margin: 0.45,
    dollarsPerHour: 45,
  }
}

describe('Product Sniper realized-learning runtime', () => {
  it('reads canonical outcomes and accumulates owner-scoped candidate learning', async () => {
    const receipts: Array<{
      id: string
      ownerUserId: string
      ventureId?: string
      kind: string
      evidenceRefs: string[]
      payload: Record<string, unknown>
      recordedAt: string
    }> = []
    const outcomes = new Map([
      ['outcome:1', outcome('outcome:1', 1)],
      ['outcome:2', outcome('outcome:2', 2)],
      ['outcome:3', outcome('outcome:3', 3)],
    ])

    const dependencies: SearchCommerceProductSniperLearningDependencies = {
      ventures: {
        async getVentureByOpportunity() {
          return venture
        },
        async listReceipts(_owner, kind) {
          if (kind === 'product_sniper_learning') {
            return receipts.filter((receipt) => receipt.kind === kind) as never
          }
          if (kind === 'seller_settlement') {
            return [...outcomes.values()].map((item) => ({
              id: 'seller-settlement:' + item.id,
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'seller_settlement',
              evidenceRefs: ['settlement:' + item.id],
              payload: {
                settlement: {
                  id: 'settlement:' + item.id,
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  sourceOwner: 'commerce',
                  provider: 'etsy',
                  accountRef: 'shop:1',
                  settlementRef: 'provider-settlement:' + item.id,
                  scope: 'sku',
                  candidateId: 'sniper:hometown-ornament',
                  productRef: 'product:ornament',
                  skuRef: 'sku:ornament',
                  currency: 'USD',
                  grossRevenue: item.grossRevenue,
                  refunds: item.refunds,
                  productCosts: item.directCosts,
                  shippingCosts: 0,
                  providerCosts: 0,
                  otherDirectCosts: 0,
                  fees: item.fees,
                  hours: item.hours,
                  costBasisComplete: true,
                  state: 'settled',
                  transactionRefs: item.transactionRefs ?? [],
                  observedAt: item.observedAt,
                  evidenceRefs: ['settlement:' + item.id],
                  authority: 'SELLER_SETTLEMENT_OBSERVATION_ONLY',
                  sourceAuthorityRetained: true,
                  externalActionAuthorized: false,
                  paymentAuthorized: false,
                  refundAuthorized: false,
                  moneyMovementAuthorized: false,
                },
              },
              recordedAt: item.observedAt,
            })) as never
          }
          if (kind === 'sku_publication') {
            return [{
              id: 'sku-publication:ornament',
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'sku_publication',
              evidenceRefs: ['publication:ornament'],
              payload: {
                receipt: {
                  id: 'publication:ornament',
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  candidateId: 'sniper:hometown-ornament',
                  productTruthId: 'truth:ornament',
                  sourceOwner: 'commerce',
                  productRef: 'product:ornament',
                  skuRef: 'sku:ornament',
                  channel: 'etsy',
                  externalListingId: '123',
                  state: 'published',
                  governanceRefs: ['approval:123'],
                  observedAt: '2026-10-01T12:00:00.000Z',
                  evidenceRefs: ['publication:ornament'],
                  authority: 'SKU_PUBLICATION_OBSERVATION_ONLY',
                  sourceAuthorityRetained: true,
                  externalActionAuthorized: false,
                  publishingAuthorized: false,
                  purchasingAuthorized: false,
                  moneyMovementAuthorized: false,
                },
              },
              recordedAt: '2026-10-01T12:00:00.000Z',
            }] as never
          }
          return []
        },
        async recordReceipt(receipt) {
          const index = receipts.findIndex((candidate) => candidate.id === receipt.id)
          if (index >= 0) receipts[index] = receipt
          else receipts.push(receipt)
          return receipt
        },
      },
      evidence: {
        async getOutcome(_opportunityId, outcomeId) {
          return outcomes.get(outcomeId)
        },
        async getExperimentEvaluation() {
          return undefined
        },
      },
    }

    let latest
    for (const id of ['outcome:1', 'outcome:2', 'outcome:3']) {
      latest = await recordSearchCommerceProductSniperOutcomeLearning(
        {} as SupabaseClient,
        {
          ownerUserId: 'owner-1',
          opportunityId: venture.opportunityId,
          candidateId: 'sniper:hometown-ornament',
          productType: 'ornament',
          marketMechanic: 'hometown identity gift',
          targetChannels: ['etsy'],
          outcomeId: id,
          observedAt: outcomes.get(id)!.observedAt,
          dependencies,
        },
      )
    }

    expect(latest?.observationCount).toBe(3)
    expect(latest?.decision).toBe('reinforce')
    expect(latest?.scoreAdjustment).toBeGreaterThan(0)
    expect(receipts).toHaveLength(3)
    expect(receipts.every((receipt) => receipt.kind === 'product_sniper_learning')).toBe(true)
  })

  it('does not accept caller-supplied economics when the canonical outcome is missing', async () => {
    const dependencies: SearchCommerceProductSniperLearningDependencies = {
      ventures: {
        async getVentureByOpportunity() {
          return venture
        },
        async listReceipts() {
          return []
        },
        async recordReceipt(receipt) {
          return receipt
        },
      },
      evidence: {
        async getOutcome() {
          return undefined
        },
        async getExperimentEvaluation() {
          return undefined
        },
      },
    }

    await expect(recordSearchCommerceProductSniperOutcomeLearning(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: 'sniper:x',
        productType: 'mug',
        marketMechanic: 'personalized gift',
        targetChannels: ['etsy'],
        outcomeId: 'missing',
        dependencies,
      },
    )).rejects.toThrow('OUTCOME_NOT_FOUND')
  })

  it('requires a settled SKU observation with overlapping transaction refs', async () => {
    const target = outcome('outcome:5', 5)
    const dependencies: SearchCommerceProductSniperLearningDependencies = {
      ventures: {
        async getVentureByOpportunity() {
          return venture
        },
        async listReceipts(_owner, kind) {
          if (kind === 'seller_settlement') {
            return [{
              id: 'settlement:wrong',
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'seller_settlement',
              evidenceRefs: ['evidence:wrong'],
              payload: {
                settlement: {
                  id: 'settlement:wrong',
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  sourceOwner: 'commerce',
                  provider: 'etsy',
                  accountRef: 'shop:1',
                  settlementRef: 'settlement:wrong',
                  scope: 'sku',
                  candidateId: 'sniper:hometown-ornament',
                  productRef: 'product:ornament',
                  skuRef: 'sku:ornament',
                  currency: 'USD',
                  grossRevenue: 100,
                  refunds: 0,
                  productCosts: 55,
                  shippingCosts: 0,
                  providerCosts: 0,
                  otherDirectCosts: 0,
                  fees: 0,
                  hours: 1,
                  costBasisComplete: true,
                  state: 'settled',
                  transactionRefs: ['transaction:other'],
                  observedAt: target.observedAt,
                  evidenceRefs: ['evidence:wrong'],
                  authority: 'SELLER_SETTLEMENT_OBSERVATION_ONLY',
                  sourceAuthorityRetained: true,
                  externalActionAuthorized: false,
                  paymentAuthorized: false,
                  refundAuthorized: false,
                  moneyMovementAuthorized: false,
                },
              },
              recordedAt: target.observedAt,
            }] as never
          }
          if (kind === 'sku_publication') {
            return [{
              id: 'sku-publication:ornament',
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'sku_publication',
              evidenceRefs: ['publication:ornament'],
              payload: {
                receipt: {
                  id: 'publication:ornament',
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  candidateId: 'sniper:hometown-ornament',
                  productTruthId: 'truth:ornament',
                  sourceOwner: 'commerce',
                  productRef: 'product:ornament',
                  skuRef: 'sku:ornament',
                  channel: 'etsy',
                  externalListingId: '123',
                  state: 'published',
                  governanceRefs: ['approval:123'],
                  observedAt: target.observedAt,
                  evidenceRefs: ['publication:ornament'],
                  authority: 'SKU_PUBLICATION_OBSERVATION_ONLY',
                  sourceAuthorityRetained: true,
                  externalActionAuthorized: false,
                  publishingAuthorized: false,
                  purchasingAuthorized: false,
                  moneyMovementAuthorized: false,
                },
              },
              recordedAt: target.observedAt,
            }] as never
          }
          return []
        },
        async recordReceipt(receipt) {
          return receipt
        },
      },
      evidence: {
        async getOutcome() {
          return target
        },
        async getExperimentEvaluation() {
          return undefined
        },
      },
    }

    await expect(recordSearchCommerceProductSniperOutcomeLearning(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: 'sniper:hometown-ornament',
        productType: 'ornament',
        marketMechanic: 'hometown identity gift',
        targetChannels: ['etsy'],
        outcomeId: target.id,
        dependencies,
      },
    )).rejects.toThrow('SELLER_SETTLEMENT_REQUIRED')
  })
})
