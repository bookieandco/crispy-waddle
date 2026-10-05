import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity } from '@jhadina/opportunity-core'
import {
  captureSearchCommerceProductPublicationRuntime,
  type SearchCommerceProductPublicationDependencies,
} from './search-commerce-product-publication-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
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
      targetChannels: ['instagram'],
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

function deps(status: 'delivered' | 'pending' = 'delivered'): SearchCommerceProductPublicationDependencies {
  return {
    ventures: {
      async getVentureByOpportunity() {
        return venture
      },
      async listReceipts(_owner, kind) {
        return kind === 'product_truth' ? [truthReceipt] as never : []
      },
      async recordReceipt(receipt) {
        return receipt
      },
    },
    social: {
      async listOutbox() {
        return [{
          id: 'social-outbox:1',
          proposalId: 'proposal:1',
          userId: 'owner-1',
          actionId: 'action:1',
          target: {
            accountId: 'account:1',
            brand: 'pupsonstuff',
            provider: 'hootsuite',
            providerProfileId: 'profile:1',
            platform: 'instagram',
          },
          text: 'New ornament',
          mediaUrls: ['https://example.com/ornament.jpg'],
          status,
          idempotencyKey: 'idem:1',
          attemptCount: status === 'delivered' ? 1 : 0,
          providerPostId: status === 'delivered' ? 'post:1' : undefined,
          createdAt: '2026-10-04T11:00:00.000Z',
          updatedAt: '2026-10-04T12:00:00.000Z',
        }]
      },
    },
  }
}

describe('Product publication lineage runtime', () => {
  it('captures already-delivered Social truth without publishing', async () => {
    const result = await captureSearchCommerceProductPublicationRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: 'sniper:hometown-ornament',
        productRef: 'pupson:ornament:1',
        outboxId: 'social-outbox:1',
        dependencies: deps(),
      },
    )

    expect(result.state).toBe('delivered')
    expect(result.providerPostId).toBe('post:1')
    expect(result.socialAuthorityRetained).toBe(true)
    expect(result.publishingAuthorized).toBe(false)
  })

  it('fails closed until Social reports delivery', async () => {
    await expect(captureSearchCommerceProductPublicationRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: 'sniper:hometown-ornament',
        productRef: 'pupson:ornament:1',
        outboxId: 'social-outbox:1',
        dependencies: deps('pending'),
      },
    )).rejects.toThrow('NOT_DELIVERED')
  })
})
