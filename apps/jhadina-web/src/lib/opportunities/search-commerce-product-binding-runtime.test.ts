import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SearchCommerceProductSniperCandidate,
  VentureOpportunity,
} from '@jhadina/opportunity-core'
import {
  recordSearchCommerceProductBindingRuntime,
  type SearchCommerceProductBindingRepository,
} from './search-commerce-product-binding-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  executionOwners: ['pupsonstuff', 'commerce'],
} as unknown as VentureOpportunity

const candidate = {
  id: 'sniper:ornament',
  ventureId: venture.id,
  family: venture.family,
  recommendation: 'hold',
  evidenceRefs: ['candidate:evidence'],
} as unknown as SearchCommerceProductSniperCandidate

function repository(candidateValue: SearchCommerceProductSniperCandidate = candidate) {
  const receipts: Array<{
    id: string
    ownerUserId: string
    ventureId?: string
    kind: string
    evidenceRefs: string[]
    payload: Record<string, unknown>
    recordedAt: string
  }> = [{
    id: 'sniper:report',
    ownerUserId: 'owner-1',
    ventureId: venture.id,
    kind: 'product_sniper',
    evidenceRefs: ['candidate:evidence'],
    payload: {
      report: {
        ventureId: venture.id,
        family: venture.family,
        evaluatedAt: '2026-10-04T12:00:00.000Z',
        candidates: [candidateValue],
        researchQueue: candidateValue.recommendation === 'research' ? [candidateValue] : [],
        holdQueue: candidateValue.recommendation === 'hold' ? [candidateValue] : [],
        rejected: candidateValue.recommendation === 'reject' ? [candidateValue] : [],
        evidenceRefs: ['candidate:evidence'],
        authority: 'PRODUCT_SNIPER_PORTFOLIO_ANALYTICS_ONLY',
        externalActionAuthorized: false,
        publishingAuthorized: false,
        purchasingAuthorized: false,
        moneyMovementAuthorized: false,
      },
    },
    recordedAt: '2026-10-04T12:00:00.000Z',
  }]
  const repo: SearchCommerceProductBindingRepository = {
    async getVentureByOpportunity() {
      return venture
    },
    async listReceipts(_owner, kind) {
      return receipts.filter((receipt) => receipt.kind === kind) as never
    },
    async recordReceipt(receipt) {
      receipts.push(receipt)
      return receipt
    },
  }
  return { repo, receipts }
}

describe('Search Commerce product binding runtime', () => {
  it('binds a non-rejected Product Sniper candidate to an explicit source SKU', async () => {
    const { repo, receipts } = repository()
    const binding = await recordSearchCommerceProductBindingRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: candidate.id,
        sourceOwner: 'pupsonstuff',
        sourceProductRef: 'ornament',
        sourceVariantRef: 'white',
        skuRef: 'pupson:ornament:white',
        targetChannels: ['pupsonstuff'],
        bindingEvidenceRefs: ['research-pack:ornament', 'catalog:ornament:white'],
        observedAt: '2026-10-04T13:00:00.000Z',
      },
      repo,
    )

    expect(binding.candidateId).toBe(candidate.id)
    expect(binding.sourceProductRef).toBe('ornament')
    expect(binding.sourceVariantRef).toBe('white')
    expect(binding.externalActionAuthorized).toBe(false)
    expect(receipts.some((receipt) => receipt.kind === 'product_binding')).toBe(true)
  })

  it('rejects an execution owner outside the Venture contract', async () => {
    const { repo } = repository()
    await expect(recordSearchCommerceProductBindingRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: candidate.id,
        sourceOwner: 'unknown-runtime',
        sourceProductRef: 'ornament',
        sourceVariantRef: 'white',
        skuRef: 'sku:1',
        targetChannels: ['pupsonstuff'],
        bindingEvidenceRefs: ['evidence:binding'],
      },
      repo,
    )).rejects.toThrow('SOURCE_OWNER_MISMATCH')
  })

  it('refuses a rejected Product Sniper candidate', async () => {
    const rejected = {
      ...candidate,
      recommendation: 'reject',
    } as SearchCommerceProductSniperCandidate
    const { repo } = repository(rejected)
    await expect(recordSearchCommerceProductBindingRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidateId: rejected.id,
        sourceOwner: 'pupsonstuff',
        sourceProductRef: 'ornament',
        sourceVariantRef: 'white',
        skuRef: 'sku:1',
        targetChannels: ['pupsonstuff'],
        bindingEvidenceRefs: ['evidence:binding'],
      },
      repo,
    )).rejects.toThrow('Rejected Product Sniper candidate')
  })
})
