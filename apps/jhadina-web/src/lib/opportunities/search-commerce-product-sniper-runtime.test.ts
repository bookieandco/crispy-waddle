import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SearchCommerceProductSniperCandidateInput,
  VentureOpportunity,
} from '@jhadina/opportunity-core'
import {
  runSearchCommerceProductSniperRuntime,
  type SearchCommerceProductSniperRepository,
} from './search-commerce-product-sniper-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
} as VentureOpportunity

function candidate(): Omit<
  SearchCommerceProductSniperCandidateInput,
  'ventureId' | 'family' | 'evaluatedAt'
> {
  const observedAt = '2026-10-03T12:00:00.000Z'
  const signal = (
    kind: SearchCommerceProductSniperCandidateInput['signals'][number]['kind'],
    score: number,
    sourceRef: string,
  ) => ({
    id: 'signal:' + kind,
    kind,
    score,
    confidence: 0.9,
    sourceRef,
    observedAt,
    note: kind + ' evidence',
  })
  return {
    id: 'sniper:1',
    title: 'Original personalized hometown ornament',
    productType: 'ornament',
    buyer: 'holiday gift buyer',
    marketMechanic: 'personal identity plus hometown nostalgia',
    originalConcept: 'Original hometown coordinate ornament system.',
    targetChannels: ['etsy'],
    signals: [
      signal('demand', 90, 'https://demand.example/a'),
      signal('buyer_intent', 88, 'https://intent.example/a'),
      signal('competition_headroom', 80, 'https://competition.example/a'),
      signal('margin_potential', 85, 'evidence:margin'),
      signal('differentiation', 85, 'evidence:differentiation'),
      signal('channel_fit', 90, 'evidence:channel'),
      signal('automation_potential', 80, 'evidence:automation'),
      signal('repeatability', 80, 'evidence:repeatability'),
      signal('platform_risk', 20, 'evidence:platform-risk'),
      signal('fulfillment_complexity', 25, 'evidence:fulfillment-risk'),
      signal('capital_risk', 10, 'evidence:capital-risk'),
    ],
    originalityEvidenceRefs: ['evidence:originality'],
  }
}

describe('Search Commerce Product Sniper runtime', () => {
  it('persists an analysis-only report against the owner venture', async () => {
    const receipts: unknown[] = []
    const repository: SearchCommerceProductSniperRepository = {
      async getVentureByOpportunity() {
        return venture
      },
      async recordReceipt(receipt) {
        receipts.push(receipt)
        return receipt
      },
    }

    const report = await runSearchCommerceProductSniperRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidates: [candidate()],
        evaluatedAt: '2026-10-04T12:00:00.000Z',
      },
      repository,
    )

    expect(report.ventureId).toBe(venture.id)
    expect(report.researchQueue).toHaveLength(1)
    expect(report.publishingAuthorized).toBe(false)
    expect(receipts).toHaveLength(1)
    expect((receipts[0] as { kind?: string }).kind).toBe('product_sniper')
  })

  it('rejects unsupported venture families', async () => {
    const repository: SearchCommerceProductSniperRepository = {
      async getVentureByOpportunity() {
        return { ...venture, family: 'media_production' } as VentureOpportunity
      },
      async recordReceipt(receipt) {
        return receipt
      },
    }

    await expect(runSearchCommerceProductSniperRuntime(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        opportunityId: venture.opportunityId,
        candidates: [candidate()],
      },
      repository,
    )).rejects.toThrow('FAMILY_NOT_SUPPORTED')
  })
})
