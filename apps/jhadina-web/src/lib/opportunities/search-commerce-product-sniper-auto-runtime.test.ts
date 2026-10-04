import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity } from '@jhadina/opportunity-core'
import {
  buildObservedEtsyCandidate,
  runSearchCommerceProductSniperAutoCycle,
  type SearchCommerceProductSniperAutoRepository,
} from './search-commerce-product-sniper-auto-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
} as unknown as VentureOpportunity

const listingSignal = {
  seedId: 'pod-personalized-market',
  family: 'pod_personalized_commerce' as const,
  sourceTitle: 'Personalized Hometown Christmas Ornament',
  sourceUrl: 'https://www.etsy.com/listing/123',
  signal: {
    id: 'venture-signal:etsy:listing:123',
    kind: 'platform_velocity' as const,
    sourceRef: 'https://www.etsy.com/listing/123',
    observedAt: '2026-10-04T10:00:00.000Z',
    value: 250,
    unit: 'listing_favorers',
    note: 'listing_title:Personalized Hometown Christmas Ornament — num_favorers:250 — sales_attribution:not_claimed',
    confidence: 0.82,
  },
}

describe('Product Sniper automatic Etsy intake', () => {
  it('creates a research-only candidate without inventing sales or margin evidence', () => {
    const candidate = buildObservedEtsyCandidate({
      ventureId: venture.id,
      family: venture.family,
      record: listingSignal,
      comparisonSet: [listingSignal],
      evaluatedAt: '2026-10-04T12:00:00.000Z',
    })

    expect(candidate.productType).toBe('ornament')
    expect(candidate.signals.map((signal) => signal.kind)).toEqual(['demand', 'channel_fit'])
    expect(candidate.signals.some((signal) => signal.kind === 'margin_potential')).toBe(false)
    expect(candidate.signals[0]?.note).toContain('not sales attribution')
    expect(candidate.originalConcept).toContain('without copying')
  })

  it('ranks observed listings into hold/evidence-gap work instead of false launch readiness', async () => {
    const work: Array<{ step: string; status: string }> = []
    const receipts: unknown[] = []
    const repository: SearchCommerceProductSniperAutoRepository = {
      async listVenturesForSupervisor() {
        return [{ ownerUserId: 'owner-1', venture }]
      },
      async listScoutSignals() {
        return [listingSignal]
      },
      async getVentureByOpportunity() {
        return venture
      },
      async listReceipts() {
        return []
      },
      async recordReceipt(receipt) {
        receipts.push(receipt)
        return receipt
      },
      async listWorkItems() {
        return work.map((item, index) => ({
          id: 'work:' + index,
          ventureId: venture.id,
          agentId: 'delia:strategy',
          step: item.step,
          status: item.status as 'queued',
          createdAt: '2026-10-04T12:00:00.000Z',
          updatedAt: '2026-10-04T12:00:00.000Z',
          evidenceRefs: ['evidence:work'],
          outputRefs: [],
          spendUsd: 0,
          authorizationEffect: 'NONE',
        }))
      },
      async upsertWorkItems(_owner, items) {
        for (const item of items) work.push({ step: item.step, status: item.status })
        return items.length
      },
    }

    const result = await runSearchCommerceProductSniperAutoCycle(
      {} as SupabaseClient,
      {
        now: '2026-10-04T12:00:00.000Z',
        repository,
      },
    )

    expect(result.status).toBe('PASS')
    expect(result.candidates).toBe(1)
    expect(result.held).toBe(1)
    expect(result.researchReady).toBe(0)
    expect(result.evidenceGapWork).toBeGreaterThan(0)
    expect(work.some((item) => item.step.startsWith('product_sniper:evidence_gap:'))).toBe(true)
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.publishingAuthorized).toBe(false)
  })
})
