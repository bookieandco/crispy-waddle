import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity } from '@jhadina/opportunity-core'
import {
  recordSearchCommerceProductCommerceLineageRuntime,
  type SearchCommerceProductCommerceLineageRepository,
} from './search-commerce-product-commerce-lineage-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  executionOwners: ['pupsonstuff', 'commerce'],
} as unknown as VentureOpportunity

const truthReceipt = {
  id: 'product-truth:venture:pod-1:ornament:1',
  ownerUserId: 'owner-1',
  ventureId: venture.id,
  kind: 'product_truth',
  evidenceRefs: ['evidence:catalog'],
  payload: {
    snapshot: {
      id: 'ornament:1',
      ventureId: venture.id,
      opportunityId: venture.opportunityId,
      family: venture.family,
      candidateId: 'sniper:hometown-ornament',
      sourceOwner: 'pupsonstuff',
      productRef: 'pupson:ornament:1',
      productType: 'ornament',
      title: 'Original hometown ornament',
      targetChannels: ['etsy'],
      catalogStatus: 'active',
      listingRefs: [],
      creativeAssetRefs: [],
      providerRefs: [],
      channelEligibility: [],
      unitEconomics: { costCompleteness: 'none' },
      fulfillment: { certification: 'unknown', evidenceRefs: [] },
      policy: { status: 'unknown', evidenceRefs: [] },
      risk: {},
      observedAt: '2026-10-04T10:00:00.000Z',
      evidenceRefs: ['evidence:catalog'],
      authority: 'SEARCH_COMMERCE_PRODUCT_TRUTH_PROJECTION_ONLY',
      sourceAuthorityRetained: true,
      externalActionAuthorized: false,
      publishingAuthorized: false,
      purchasingAuthorized: false,
      moneyMovementAuthorized: false,
    },
  },
  recordedAt: '2026-10-04T10:00:00.000Z',
} as const

describe('Product Commerce lineage runtime', () => {
  it('binds a source-owned order/transaction to existing Product Truth', async () => {
    const receipts: unknown[] = []
    const repository: SearchCommerceProductCommerceLineageRepository = {
      async getVentureByOpportunity() {
        return venture
      },
      async listReceipts(_owner, kind) {
        return kind === 'product_truth' ? [truthReceipt] as never : []
      },
      async recordReceipt(receipt) {
        receipts.push(receipt)
        return receipt
      },
    }

    const lineage = await recordSearchCommerceProductCommerceLineageRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        lineage: {
          id: 'order:1',
          candidateId: 'sniper:hometown-ornament',
          productRef: 'pupson:ornament:1',
          sourceOwner: 'pupsonstuff',
          eventKind: 'settlement',
          orderRefs: ['order:1'],
          transactionRefs: ['transaction:stripe:1'],
          fulfillmentRefs: ['printify:order:1'],
          evidenceRefs: ['evidence:order'],
          observedAt: '2026-10-04T12:00:00.000Z',
        },
      },
      repository,
    )

    expect(lineage.transactionRefs).toContain('transaction:stripe:1')
    expect(lineage.sourceAuthorityRetained).toBe(true)
    expect(lineage.moneyMovementAuthorized).toBe(false)
    expect(receipts).toHaveLength(1)
  })

  it('requires Product Truth for the same candidate/product identity', async () => {
    const repository: SearchCommerceProductCommerceLineageRepository = {
      async getVentureByOpportunity() {
        return venture
      },
      async listReceipts() {
        return []
      },
      async recordReceipt(receipt) {
        return receipt
      },
    }

    await expect(recordSearchCommerceProductCommerceLineageRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        lineage: {
          id: 'order:2',
          candidateId: 'sniper:missing',
          productRef: 'pupson:missing',
          sourceOwner: 'pupsonstuff',
          eventKind: 'order',
          transactionRefs: ['transaction:2'],
          evidenceRefs: ['evidence:2'],
          observedAt: '2026-10-04T12:00:00.000Z',
        },
      },
      repository,
    )).rejects.toThrow('PRODUCT_TRUTH_REQUIRED')
  })
})
