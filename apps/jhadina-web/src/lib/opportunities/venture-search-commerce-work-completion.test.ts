import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity, VentureWorkItem } from '@jhadina/opportunity-core'
import {
  completeSearchCommerceBusinessWork,
  type SearchCommerceWorkCompletionRepository,
} from './venture-search-commerce-work-completion'

const venture = { id: 'venture:1' } as VentureOpportunity

function baseWork(status: VentureWorkItem['status'] = 'queued'): VentureWorkItem {
  return {
    id: 'business-work:venture:1:weekly_market_research:2026-W40',
    ventureId: venture.id,
    agentId: 'marisa:operations',
    step: 'search_commerce:weekly_market_research',
    status,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    evidenceRefs: ['market:input'],
    outputRefs: [],
    spendUsd: 0,
    authorizationEffect: 'NONE',
  }
}

function repository(item: VentureWorkItem) {
  let current = item
  const repo: SearchCommerceWorkCompletionRepository = {
    async getVenture() {
      return venture
    },
    async listWorkItems() {
      return [current]
    },
    async upsertWorkItems(_owner, items) {
      current = items[0] ?? current
      return items.length
    },
  }
  return { repo, current: () => current }
}

describe('Search Commerce Business Factory work completion', () => {
  it('requires real output evidence before advancing cadence', async () => {
    const { repo, current } = repository(baseWork())
    const completed = await completeSearchCommerceBusinessWork(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        ventureId: venture.id,
        workItemId: baseWork().id,
        completedAt: '2026-10-03T12:00:00.000Z',
        evidenceRefs: ['market:analysis'],
        outputRefs: ['artifact:weekly-market-review:2026-W40'],
      },
      repo,
    )

    expect(completed.status).toBe('completed')
    expect(completed.outputRefs).toContain('artifact:weekly-market-review:2026-W40')
    expect(completed.evidenceRefs).toContain('market:analysis')
    expect(current().status).toBe('completed')
    expect(completed.authorizationEffect).toBe('NONE')
  })

  it('rejects superseded work and idempotently accepts the same completed output', async () => {
    const superseded = repository(baseWork('superseded'))
    await expect(completeSearchCommerceBusinessWork(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        ventureId: venture.id,
        workItemId: baseWork().id,
        completedAt: '2026-10-03T12:00:00.000Z',
        evidenceRefs: ['evidence:x'],
        outputRefs: ['artifact:x'],
      },
      superseded.repo,
    )).rejects.toThrow('SUPERSEDED')

    const completedItem = {
      ...baseWork('completed'),
      outputRefs: ['artifact:x'],
    }
    const completedRepo = repository(completedItem)
    const result = await completeSearchCommerceBusinessWork(
      {} as SupabaseClient,
      {
        ownerUserId: 'owner-1',
        ventureId: venture.id,
        workItemId: completedItem.id,
        completedAt: '2026-10-03T12:00:00.000Z',
        evidenceRefs: ['evidence:x'],
        outputRefs: ['artifact:x'],
      },
      completedRepo.repo,
    )
    expect(result).toEqual(completedItem)
  })
})


it('completes Product Sniper research with an evidence-backed research pack', async () => {
  const sniperWork: VentureWorkItem = {
    id: 'product-sniper-work:venture:1:sniper:ornament',
    ventureId: venture.id,
    agentId: 'delia:strategy',
    step: 'product_sniper:research:sniper:ornament',
    status: 'queued',
    createdAt: '2026-10-03T08:00:00.000Z',
    updatedAt: '2026-10-03T08:00:00.000Z',
    evidenceRefs: ['sniper:input'],
    outputRefs: [],
    spendUsd: 0,
    authorizationEffect: 'NONE',
  }
  const { repo, current } = repository(sniperWork)
  const completed = await completeSearchCommerceBusinessWork(
    {} as SupabaseClient,
    {
      ownerUserId: 'owner-1',
      ventureId: venture.id,
      workItemId: sniperWork.id,
      completedAt: '2026-10-04T12:00:00.000Z',
      evidenceRefs: ['research:evidence'],
      outputRefs: ['artifact:product-research-pack:ornament'],
    },
    repo,
  )

  expect(completed.status).toBe('completed')
  expect(completed.outputRefs).toContain('artifact:product-research-pack:ornament')
  expect(current().status).toBe('completed')
  expect(completed.authorizationEffect).toBe('NONE')
})
