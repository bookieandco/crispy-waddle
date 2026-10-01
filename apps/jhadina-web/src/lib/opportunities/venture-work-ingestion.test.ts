import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureOpportunity, VentureWorkItem } from '@jhadina/opportunity-core'
import {
  ingestVentureWorkReceipt,
  type VentureWorkIngestionRepository,
} from './venture-work-ingestion'

const venture = { id: 'venture:1' } as VentureOpportunity

function repository() {
  const saved: VentureWorkItem[] = []
  const repo: VentureWorkIngestionRepository = {
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

describe('venture work ingestion', () => {
  it('rejects completed work that has no output receipt', async () => {
    const { repo } = repository()
    await expect(ingestVentureWorkReceipt({} as SupabaseClient, {
      ownerUserId: 'user-1',
      ventureId: 'venture:1',
      workItemId: 'work:1',
      agentId: 'agent:designer',
      step: 'original_concept_generation',
      status: 'completed',
      createdAt: '2026-10-01T15:00:00.000Z',
      observedAt: '2026-10-01T15:05:00.000Z',
      spendUsd: 0.25,
      evidenceRefs: ['run:receipt:1'],
      outputRefs: [],
    }, repo)).rejects.toThrow('VENTURE_WORK_COMPLETED_OUTPUT_REQUIRED')
  })

  it('persists evidence-backed completed work without granting authority', async () => {
    const { repo, saved } = repository()
    const item = await ingestVentureWorkReceipt({} as SupabaseClient, {
      ownerUserId: 'user-1',
      ventureId: 'venture:1',
      workItemId: 'work:2',
      agentId: 'agent:designer',
      step: 'original_concept_generation',
      status: 'completed',
      createdAt: '2026-10-01T15:00:00.000Z',
      observedAt: '2026-10-01T15:05:00.000Z',
      spendUsd: 0.25,
      evidenceRefs: ['run:receipt:2'],
      outputRefs: ['artifact:concept:2'],
    }, repo)

    expect(saved).toHaveLength(1)
    expect(item.outputRefs).toEqual(['artifact:concept:2'])
    expect(item.authorizationEffect).toBe('NONE')
  })
})
