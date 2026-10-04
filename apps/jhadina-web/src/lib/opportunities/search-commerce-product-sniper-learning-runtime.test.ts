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
          if (kind === 'product_commerce_lineage') {
            return [...outcomes.values()].map((item) => ({
              id: 'lineage-receipt:' + item.id,
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'product_commerce_lineage',
              evidenceRefs: ['lineage:' + item.id],
              payload: {
                lineage: {
                  id: 'lineage:' + item.id,
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  candidateId: 'sniper:hometown-ornament',
                  productRef: 'pupson:ornament:1',
                  sourceOwner: 'pupsonstuff',
                  eventKind: 'settlement',
                  orderRefs: ['order:' + item.id],
                  transactionRefs: item.transactionRefs ?? [],
                  fulfillmentRefs: [],
                  evidenceRefs: ['lineage:' + item.id],
                  observedAt: item.observedAt,
                  authority: 'SEARCH_COMMERCE_PRODUCT_COMMERCE_LINEAGE_ONLY',
                  sourceAuthorityRetained: true,
                  financialTruthOwnedByOutcomeLedger: true,
                  externalActionAuthorized: false,
                  publishingAuthorized: false,
                  purchasingAuthorized: false,
                  moneyMovementAuthorized: false,
                },
              },
              recordedAt: item.observedAt,
            })) as never
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
})


  it('requires canonical product commerce lineage with overlapping transaction refs', async () => {
    const target = outcome('outcome:5', {
      result: 'won',
      grossRevenue: 100,
      totalCosts: 60,
      profit: 40,
      margin: 0.4,
      transaction: true,
      day: 5,
    })
    const dependencies: SearchCommerceProductSniperLearningDependencies = {
      ventures: {
        async getVentureByOpportunity() {
          return venture
        },
        async listReceipts(_owner, kind) {
          if (kind === 'product_commerce_lineage') {
            return [{
              id: 'lineage:wrong',
              ownerUserId: 'owner-1',
              ventureId: venture.id,
              kind: 'product_commerce_lineage',
              evidenceRefs: ['evidence:wrong'],
              payload: {
                lineage: {
                  id: 'lineage:wrong',
                  ventureId: venture.id,
                  opportunityId: venture.opportunityId,
                  family: venture.family,
                  candidateId: 'sniper:hometown-ornament',
                  productRef: 'pupson:ornament:1',
                  sourceOwner: 'pupsonstuff',
                  eventKind: 'settlement',
                  orderRefs: ['order:wrong'],
                  transactionRefs: ['transaction:other'],
                  fulfillmentRefs: [],
                  evidenceRefs: ['evidence:wrong'],
                  observedAt: target.observedAt,
                  authority: 'SEARCH_COMMERCE_PRODUCT_COMMERCE_LINEAGE_ONLY',
                  sourceAuthorityRetained: true,
                  financialTruthOwnedByOutcomeLedger: true,
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
    )).rejects.toThrow('COMMERCE_LINEAGE_REQUIRED')
  })
