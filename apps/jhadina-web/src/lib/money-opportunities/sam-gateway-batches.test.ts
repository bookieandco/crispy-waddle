import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  SAM_GATEWAY_MUTATION_BYTE_BUDGET,
  SAM_GATEWAY_MUTATION_ROW_BUDGET,
  persistSamCatalogBatches,
  splitSamGatewayUpserts,
} from './sam-gateway-batches'

const options = { onConflict: 'notice_id' }
const envelope = (rows: unknown[]) => ({
  action: 'db', request: { table: 'jhadina_sam_catalog', filters: [], method: 'upsert', payload: rows, options },
})

describe('SAM runtime gateway bounded mutation batches', () => {
  it('splits the observed 250-row / >5MB class without dropping order or records', () => {
    const records = Array.from({ length: 250 }, (_, n) => ({
      notice_id: `notice-${n}`, raw: { description: 'x'.repeat(26_000) },
    }))
    expect(new TextEncoder().encode(JSON.stringify(envelope(records))).byteLength).toBeGreaterThan(5_000_000)
    const batches = splitSamGatewayUpserts('jhadina_sam_catalog', records, options)
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flat().map(row => row.notice_id)).toEqual(records.map(row => row.notice_id))
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(SAM_GATEWAY_MUTATION_ROW_BUDGET)
      expect(new TextEncoder().encode(JSON.stringify(envelope(batch))).byteLength)
        .toBeLessThanOrEqual(SAM_GATEWAY_MUTATION_BYTE_BUDGET)
    }
  })

  it('counts UTF-8 wire bytes, not JavaScript string length', () => {
    expect(() => splitSamGatewayUpserts(
      'jhadina_sam_catalog',
      [{ notice_id: 'large-unicode', raw: '🐕'.repeat(1_100_000) }],
      options,
    )).toThrow('SAM_GATEWAY_SINGLE_ROW_EXCEEDS_BUDGET')
  })

  it('preflights catalog and version payloads before any database write', async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient
    await expect(persistSamCatalogBatches(client,
      [{ notice_id: 'valid' }],
      [{ notice_id: 'invalid', snapshot: '🚚'.repeat(1_100_000) }],
    )).rejects.toThrow('SAM_GATEWAY_SINGLE_ROW_EXCEEDS_BUDGET')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('persists all split catalog rows before idempotent history and propagates errors', async () => {
    const writes: { table: string; rows: Record<string, unknown>[]; options: Record<string, unknown> }[] = []
    const client = {
      from: (table: string) => ({
        upsert: async (rows: Record<string, unknown>[], opts: Record<string, unknown>) => {
          writes.push({ table, rows, options: opts })
          return { error: null }
        },
      }),
    } as unknown as SupabaseClient
    const catalog = Array.from({ length: 240 }, (_, n) => ({ notice_id: String(n), raw: 'x'.repeat(25_000) }))
    const versions = catalog.map((row) => ({ notice_id: row.notice_id, checksum: 'official-source-checksum' }))
    await persistSamCatalogBatches(client, catalog, versions)
    expect(writes.filter(write => write.table === 'jhadina_sam_catalog').length).toBeGreaterThan(1)
    expect(writes.flatMap(write => write.rows).filter(row => 'raw' in row)).toEqual(catalog)
    expect(writes.flatMap(write => write.rows).filter(row => 'checksum' in row)).toEqual(versions)
    expect(writes[writes.length - 1]?.options).toEqual({ onConflict: 'notice_id,checksum', ignoreDuplicates: true })
    expect(writes.findIndex(write => write.table === 'jhadina_sam_versions'))
      .toBe(writes.filter(write => write.table === 'jhadina_sam_catalog').length)
  })

  it('fails a catalog upsert without attempting version writes', async () => {
    const calls: string[] = []
    const client = {
      from: (table: string) => ({
        upsert: async () => {
          calls.push(table)
          return { error: table === 'jhadina_sam_catalog' ? { message: 'database unavailable' } : null }
        },
      }),
    } as unknown as SupabaseClient
    await expect(persistSamCatalogBatches(client,
      [{ notice_id: 'id-1' }],
      [{ notice_id: 'id-1', checksum: 'abc' }],
    )).rejects.toThrow('Unable to persist SAM catalog: database unavailable')
    expect(calls).toEqual(['jhadina_sam_catalog'])
  })

  it('does nothing for empty input', async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient
    await persistSamCatalogBatches(client, [], [])
    expect(client.from).not.toHaveBeenCalled()
  })
})
