import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OpportunityOutcome,
  VentureOpportunity,
  VentureWorkItem,
} from '@jhadina/opportunity-core'
import {
  reconcileSearchCommerceProjectedWork,
  runVentureSearchCommerceBusinessCycle,
  type SearchCommerceBusinessCycleDependencies,
} from './venture-search-commerce-business-cycle'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  lifecycle: 'validated',
  signals: [],
  evidenceRefs: ['venture:evidence'],
} as VentureOpportunity

function work(input: Partial<VentureWorkItem> & Pick<VentureWorkItem, 'id' | 'step' | 'status'>): VentureWorkItem {
  return {
    ventureId: venture.id,
    agentId: 'marisa:operations',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    evidenceRefs: ['work:evidence'],
    outputRefs: [],
    spendUsd: 0,
    authorizationEffect: 'NONE',
    ...input,
  }
}

describe('Search Commerce Business Factory cycle runtime', () => {
  it('supersedes old queued periods, carries running work, and preserves idempotency', () => {
    const existing = [
      work({
        id: 'business-work:venture:pod-1:daily_shop_health:2026-10-02',
        step: 'search_commerce:daily_shop_health',
        status: 'queued',
      }),
      work({
        id: 'business-work:venture:pod-1:weekly_market_research:2026-W40',
        step: 'search_commerce:weekly_market_research',
        status: 'running',
      }),
      work({
        id: 'business-work:venture:pod-1:monthly_shop_audit:2026-10',
        step: 'search_commerce:monthly_shop_audit',
        status: 'blocked',
        evidenceRefs: ['work:evidence', 'task:monthly'],
      }),
    ]
    const planned = [
      work({
        id: 'business-work:venture:pod-1:daily_shop_health:2026-10-03',
        step: 'search_commerce:daily_shop_health',
        status: 'blocked',
        createdAt: '2026-10-03T10:00:00.000Z',
        updatedAt: '2026-10-03T10:00:00.000Z',
      }),
      work({
        id: 'business-work:venture:pod-1:monthly_shop_audit:2026-10',
        step: 'search_commerce:monthly_shop_audit',
        status: 'blocked',
        evidenceRefs: ['task:monthly', 'work:evidence'],
      }),
    ]

    const result = reconcileSearchCommerceProjectedWork({
      existing,
      planned,
      queue: {
        tasks: [
          { routineId: 'daily_shop_health', periodKey: '2026-10-03' },
          { routineId: 'weekly_market_research', periodKey: '2026-W40' },
          { routineId: 'monthly_shop_audit', periodKey: '2026-10' },
        ],
      },
      observedAt: '2026-10-03T10:00:00.000Z',
    })

    expect(result.superseded).toHaveLength(1)
    expect(result.superseded[0]?.status).toBe('superseded')
    expect(result.carriedForwardRoutineIds).toContain('weekly_market_research')
    expect(result.upserts).toHaveLength(1)
    expect(result.upserts[0]?.id).toContain('daily_shop_health:2026-10-03')
    expect(result.unchanged).toBe(1)
  })

  it('runs an evidence-backed batch into the existing Venture work ledger', async () => {
    const saved: VentureWorkItem[] = []
    const receipts: unknown[] = []
    const dependencies: SearchCommerceBusinessCycleDependencies = {
      ventures: {
        async listVenturesForSupervisor() {
          return [{ ownerUserId: 'owner-1', venture }]
        },
        async listWorkItems() {
          return []
        },
        async listScoutSignals() {
          return [{
            seedId: 'pod-personalized-market',
            family: 'pod_personalized_commerce',
            sourceTitle: 'Observed Etsy shop',
            sourceUrl: 'https://www.etsy.com/shop/example',
            signal: {
              id: 'signal:etsy',
              kind: 'platform_velocity',
              sourceRef: 'https://www.etsy.com/shop/example',
              observedAt: '2026-10-03T08:00:00.000Z',
              value: 10,
              unit: 'listing_favorers',
              note: 'scope:shop_level',
              confidence: 0.8,
            },
          }]
        },
        async upsertWorkItems(_owner, items) {
          saved.push(...items)
          return items.length
        },
        async recordReceipt(receipt) {
          receipts.push(receipt)
          return receipt
        },
        async listReceipts() {
          return []
        },
      },
      evidence: {
        async listOutcomes() {
          return [{
            id: 'outcome:1',
            opportunityId: venture.opportunityId,
            result: 'won',
            currency: 'USD',
            grossRevenue: 100,
            refunds: 0,
            directCosts: 40,
            fees: 10,
            hours: 1,
            sourceOwner: 'commerce',
            evidenceRefs: ['commerce:outcome:1'],
            observedAt: '2026-10-03T09:00:00.000Z',
            netRevenue: 100,
            totalCosts: 50,
            profit: 50,
            margin: 0.5,
            dollarsPerHour: 50,
          } satisfies OpportunityOutcome]
        },
        async listExperiments() {
          return []
        },
      },
    }

    const result = await runVentureSearchCommerceBusinessCycle(
      {} as SupabaseClient,
      {
        now: '2026-10-03T10:00:00.000Z',
        businessDate: '2026-10-03',
        dependencies,
      },
    )

    expect(result.status).toBe('PASS')
    expect(result.searchCommerceVentures).toBe(1)
    expect(result.upsertedWorkItems).toBeGreaterThan(0)
    expect(saved.every((item) => item.ventureId === venture.id)).toBe(true)
    expect(saved.every((item) => item.authorizationEffect === 'NONE')).toBe(true)
    expect(receipts).toHaveLength(1)
    expect((receipts[0] as { kind?: string }).kind).toBe('business_pipeline')
  })
})
