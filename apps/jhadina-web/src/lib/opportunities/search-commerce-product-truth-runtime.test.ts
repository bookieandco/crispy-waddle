import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity } from '@jhadina/opportunity-core'
import {
  recordSearchCommerceProductTruthRuntime,
  type SearchCommerceProductTruthRepository,
} from './search-commerce-product-truth-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  executionOwners: ['pupsonstuff', 'commerce'],
} as unknown as VentureOpportunity

describe('Search Commerce Product Truth runtime', () => {
  it('persists source-owned product truth without granting pipeline authority', async () => {
    const receipts: unknown[] = []
    const repository: SearchCommerceProductTruthRepository = {
      async getVentureByOpportunity() {
        return venture
      },
      async recordReceipt(receipt) {
        receipts.push(receipt)
        return receipt
      },
    }

    const snapshot = await recordSearchCommerceProductTruthRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        productTruth: {
          id: 'ornament:1',
          sourceOwner: 'pupsonstuff',
          productRef: 'pupson:ornament:1',
          productType: 'ornament',
          title: 'Original hometown ornament',
          targetChannels: ['etsy'],
          catalogStatus: 'active',
          listingRefs: ['listing:etsy:1'],
          unitEconomics: {
            currency: 'USD',
            retailPrice: 30,
            productCost: 8,
            merchantShippingCost: 5,
            platformFees: 3,
            providerCost: 2,
          },
          fulfillment: {
            certification: 'sample_verified',
            evidenceRefs: ['evidence:sample'],
          },
          observedAt: '2026-10-04T12:00:00.000Z',
          evidenceRefs: ['evidence:catalog'],
        },
      },
      repository,
    )

    expect(snapshot.ventureId).toBe(venture.id)
    expect(snapshot.unitEconomics.expectedContributionPerUnit).toBe(12)
    expect(snapshot.sourceAuthorityRetained).toBe(true)
    expect(snapshot.externalActionAuthorized).toBe(false)
    expect(receipts).toHaveLength(1)
    expect((receipts[0] as { kind?: string }).kind).toBe('product_truth')
  })

  it('rejects a source owner that does not own execution for the venture', async () => {
    const repository: SearchCommerceProductTruthRepository = {
      async getVentureByOpportunity() {
        return venture
      },
      async recordReceipt(receipt) {
        return receipt
      },
    }

    await expect(recordSearchCommerceProductTruthRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        productTruth: {
          id: 'x',
          sourceOwner: 'unknown-runtime',
          productRef: 'x',
          productType: 'mug',
          title: 'Mug',
          targetChannels: ['etsy'],
          catalogStatus: 'candidate',
          observedAt: '2026-10-04T12:00:00.000Z',
          evidenceRefs: ['evidence:x'],
        },
      },
      repository,
    )).rejects.toThrow('SOURCE_OWNER_MISMATCH')
  })
})
