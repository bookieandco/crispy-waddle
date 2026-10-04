import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSearchCommerceDueTaskQueue,
  type VentureOpportunity,
  type VentureWorkItem,
} from '@jhadina/opportunity-core'
import {
  persistSearchCommerceBusinessPipeline,
  type SearchCommerceBusinessPipelineRepository,
} from './search-commerce-business-pipeline-runtime'

const venture = {
  id: 'venture:pod-1',
  opportunityId: 'opportunity:pod-1',
  family: 'pod_personalized_commerce',
  evidenceRefs: ['evidence:venture'],
} as VentureOpportunity

function repository() {
  const saved: VentureWorkItem[] = []
  const repo: SearchCommerceBusinessPipelineRepository = {
    async getVenture() {
      return venture
    },
    async upsertWorkItems(_ownerUserId, items) {
      saved.push(...items)
      return items.length
    },
  }
  return { repo, saved }
}

describe('search commerce Business Factory pipeline runtime', () => {
  it('persists due work into the canonical Venture work ledger', async () => {
    const { repo, saved } = repository()
    const queue = buildSearchCommerceDueTaskQueue({
      family: 'pod_personalized_commerce',
      businessDate: '2026-10-03',
      availableInputKeys: [
        'orders',
        'messages',
        'listing-health observations',
        'provider alerts',
      ],
    })

    const result = await persistSearchCommerceBusinessPipeline(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        ventureId: venture.id,
        queue,
        observedAt: '2026-10-04T06:58:00.000Z',
        evidenceRefs: ['evidence:storefront'],
      },
      repo,
    )

    expect(result.persisted).toBe(9)
    expect(saved).toHaveLength(9)
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.moneyMovementAuthorized).toBe(false)
    expect(saved.every((item) => item.ventureId === venture.id)).toBe(true)
    expect(saved.every((item) => item.agentId === 'marisa:operations')).toBe(true)
    expect(saved.every((item) => item.authorizationEffect === 'NONE')).toBe(true)
  })

  it('rejects a queue belonging to another business family', async () => {
    const { repo } = repository()
    await expect(persistSearchCommerceBusinessPipeline(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        ventureId: venture.id,
        queue: buildSearchCommerceDueTaskQueue({
          family: 'digital_products',
          businessDate: '2026-10-03',
        }),
        evidenceRefs: ['evidence:x'],
      },
      repo,
    )).rejects.toThrow('FAMILY_MISMATCH')
  })
})
