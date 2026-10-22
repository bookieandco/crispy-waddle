import type { SupabaseClient } from '@supabase/supabase-js'
import { checksumSamNotice } from '@jhadina/opportunity-core'
import { describe, expect, it } from 'vitest'
import { planSamHistoryRepairs, reconcileSamObservedHistory } from './sam-history-recovery'

const raw = { noticeId: 'notice-1', title: 'Real government source', uiLink: 'https://sam.gov/opp/notice-1/view' }
const identity = { notice_id: 'notice-1', version: 1, checksum: checksumSamNotice(raw) }
const stored = { ...identity, raw, source_url: 'https://sam.gov/opp/notice-1/view', last_seen_at: '2026-10-02T10:00:00.000Z' }

function mockClient(options: {
  history?: { notice_id: string; version: number; checksum: string }[]
  catalogs?: Record<string, unknown>[]
  historyCount?: number
  catalogCount?: number
  writeError?: string
} = {}) {
  const history = options.history ?? []
  const catalog = options.catalogs ?? [stored]
  const writes: { table: string; data: unknown; opts: unknown }[] = []
  const readCalls: string[] = []
  const client = {
    from: (table: string) => ({
      select: (_fields: string, _opts: Record<string, unknown>) => {
        readCalls.push(table)
        // Mock the chained Supabase read builder, retaining count semantics.
        return {
          in: (_column: string, _values: unknown[]) => ({
            in: (_version: string, _versions: number[]) => ({
              limit: async () => ({ data: history, count: options.historyCount ?? history.length, error: null }),
            }),
            limit: async () => ({ data: catalog, count: options.catalogCount ?? catalog.length, error: null }),
          }),
        }
      },
      upsert: async (data: unknown, opts: unknown) => {
        writes.push({ table, data, opts })
        return { error: options.writeError ? { message: options.writeError } : null }
      },
    }),
  } as unknown as SupabaseClient
  return { client, readCalls, writes }
}

describe('SAM catalog/version history continuity', () => {
  it('reconstructs only checksum-verified official historical source', () => {
    const rows = planSamHistoryRepairs([stored])
    expect(rows).toEqual([{ notice_id: 'notice-1', version: 1, checksum: identity.checksum, snapshot: raw, captured_at: stored.last_seen_at }])
  })
  it('rejects changed raw evidence without inventing historical records', () => {
    expect(() => planSamHistoryRepairs([{ ...stored, raw: { ...raw, title: 'Changed without checksum' } }]))
      .toThrow('SAM_HISTORY_REPAIR_CHECKSUM_OR_IDENTITY_MISMATCH')
  })
  it('rejects untrusted source origin, wrong notice ID, and bad timestamp', () => {
    expect(() => planSamHistoryRepairs([{ ...stored, source_url: 'http://example.org/fake' }]))
      .toThrow('SAM_HISTORY_REPAIR_UNTRUSTED_CATALOG_EVIDENCE')
    expect(() => planSamHistoryRepairs([{ ...stored, notice_id: 'different' }]))
      .toThrow('SAM_HISTORY_REPAIR_CHECKSUM_OR_IDENTITY_MISMATCH')
    expect(() => planSamHistoryRepairs([{ ...stored, last_seen_at: 'not-a-date' }]))
      .toThrow('SAM_HISTORY_REPAIR_UNTRUSTED_CATALOG_EVIDENCE')
  })
  it('defaults to read-only inspection for missing snapshots', async () => {
    const fixture = mockClient()
    const result = await reconcileSamObservedHistory(fixture.client, [identity])
    expect(result).toEqual({ missing: 1, repaired: 0 })
    expect(fixture.writes).toEqual([])
  })
  it('writes only a verified missing snapshot, without overwriting history', async () => {
    const fixture = mockClient()
    const result = await reconcileSamObservedHistory(fixture.client, [identity], { write: true })
    expect(result).toEqual({ missing: 1, repaired: 1 })
    expect(fixture.writes).toHaveLength(1)
    expect(fixture.writes[0]).toMatchObject({
      table: 'jhadina_sam_versions',
      opts: { onConflict: 'notice_id,checksum', ignoreDuplicates: true },
    })
  })
  it('is idempotent when the matching historical version already exists', async () => {
    const fixture = mockClient({ history: [identity] })
    expect(await reconcileSamObservedHistory(fixture.client, [identity], { write: true }))
      .toEqual({ missing: 0, repaired: 0 })
    expect(fixture.writes).toEqual([])
  })
  it('fails closed if a version number exists for a different checksum', async () => {
    const fixture = mockClient({ history: [{ ...identity, checksum: 'b'.repeat(64) }] })
    await expect(reconcileSamObservedHistory(fixture.client, [identity], { write: true }))
      .rejects.toThrow('SAM_HISTORY_REPAIR_VERSION_COLLISION')
    expect(fixture.writes).toEqual([])
  })
  it('fails closed on incomplete pagination and changing/missing catalog rows', async () => {
    const incomplete = mockClient({ history: [], historyCount: 5001 })
    await expect(reconcileSamObservedHistory(incomplete.client, [identity], { write: true }))
      .rejects.toThrow('SAM_HISTORY_REPAIR_HISTORY_TRUNCATED')
    expect(incomplete.writes).toEqual([])
    const missing = mockClient({ catalogs: [], catalogCount: 0 })
    await expect(reconcileSamObservedHistory(missing.client, [identity], { write: true }))
      .rejects.toThrow('SAM_HISTORY_REPAIR_CATALOG_INCOMPLETE')
    const changed = mockClient({ catalogs: [{ ...stored, checksum: 'b'.repeat(64) }] })
    await expect(reconcileSamObservedHistory(changed.client, [identity], { write: true }))
      .rejects.toThrow('SAM_HISTORY_REPAIR_CATALOG_CHANGED')
  })
  it('propagates a failed history write instead of certifying recovery', async () => {
    const fixture = mockClient({ writeError: 'database unavailable' })
    await expect(reconcileSamObservedHistory(fixture.client, [identity], { write: true }))
      .rejects.toThrow('Unable to persist SAM versions: database unavailable')
  })
  it('makes no reads or writes for an empty catalog chunk', async () => {
    const fixture = mockClient()
    expect(await reconcileSamObservedHistory(fixture.client, [], { write: true }))
      .toEqual({ missing: 0, repaired: 0 })
    expect(fixture.readCalls).toEqual([])
  })
})
