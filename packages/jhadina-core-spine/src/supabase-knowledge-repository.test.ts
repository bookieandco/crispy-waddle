import { describe, expect, it } from 'vitest'
import type { KnowledgeRecord } from './knowledge.js'
import { SupabaseKnowledgeRepository, type KnowledgeSupabaseClient } from './supabase-knowledge-repository.js'

const record: KnowledgeRecord = {
  id: 'knowledge-1',
  subject: 'SAM opportunity',
  claim: 'The opportunity requires research before action.',
  confidence: 0.9,
  evidence: [{ id: 'e1', claim: 'SAM listing', confidence: 0.95, provenance: [{ sourceKind: 'domain', sourceId: 'sam', capturedAt: '2026-08-28T00:00:00Z' }] }],
  createdAt: '2026-08-28T00:00:00Z',
  updatedAt: '2026-08-28T00:00:00Z',
}

function mockClient(seed: KnowledgeRecord[] = []) {
  const rows = new Map(seed.map((item) => [item.id, { id: item.id, subject: item.subject, claim: item.claim, confidence: item.confidence, status: 'ACTIVE', invalidation_reason: null, evidence: item.evidence, created_at: item.createdAt, updated_at: item.updatedAt }]))
  const client = {
    from() {
      return {
        upsert(values: Record<string, unknown>) {
          rows.set(String(values.id), { ...values, created_at: values.created_at ?? new Date().toISOString(), updated_at: values.updated_at ?? new Date().toISOString() })
          return { select: () => ({ single: async () => ({ data: rows.get(String(values.id)) ?? null, error: null }) }) }
        },
        select() {
          const filters: Record<string, unknown> = {}
          return {
            eq(column: string, value: unknown) {
              filters[column] = value
              const chain = {
                order: (_column: string, _options?: { ascending?: boolean }) => ({ limit: async (count: number) => ({ data: [...rows.values()].filter((row) => Object.entries(filters).every(([key, expected]) => row[key] === expected)).slice(0, count), error: null }) }),
                ilike: (column2: string, pattern: string) => {
                  filters[column2] = pattern.replace(/^%|%$/g, '').toLowerCase()
                  return { order: (_column: string, _options?: { ascending?: boolean }) => ({ limit: async (count: number) => ({ data: [...rows.values()].filter((row) => Object.entries(filters).every(([key, expected]) => key === 'subject' || key === 'claim' ? String(row[key]).toLowerCase().includes(String(expected)) : row[key] === expected)).slice(0, count), error: null }) }) }
                },
              }
              return chain
            },
          }
        },
        update(values: Record<string, unknown>) {
          return { eq: async (column: string, value: unknown) => { const row = rows.get(String(value)); if (row) Object.assign(row, values); return { select: () => ({ single: async () => ({ data: row ?? null, error: null }) }) } } }
        },
      }
    },
  } as unknown as KnowledgeSupabaseClient
  return { client, rows }
}

describe('SupabaseKnowledgeRepository', () => {
  it('upserts and returns a knowledge record', async () => {
    const { client, rows } = mockClient()
    const repo = new SupabaseKnowledgeRepository(client)
    const saved = await repo.ingest(record)
    expect(saved.id).toBe(record.id)
    expect(rows.has(record.id)).toBe(true)
  })

  it('retrieves active knowledge', async () => {
    const { client } = mockClient([record])
    const repo = new SupabaseKnowledgeRepository(client)
    await expect(repo.retrieve({ text: 'research' })).resolves.toHaveLength(1)
  })

  it('revises a record by stable id', async () => {
    const { client } = mockClient([record])
    const repo = new SupabaseKnowledgeRepository(client)
    const revised = { ...record, claim: 'The opportunity is ready for research.' }
    await expect(repo.revise(record.id, revised)).resolves.toMatchObject({ id: record.id, claim: revised.claim })
  })

  it('invalidates without deleting the row', async () => {
    const { client, rows } = mockClient([record])
    const repo = new SupabaseKnowledgeRepository(client)
    await repo.invalidate(record.id, 'Superseded by newer evidence')
    expect(rows.get(record.id)?.status).toBe('INVALIDATED')
    await expect(repo.retrieve({ text: 'research' })).resolves.toHaveLength(0)
  })

  it('rejects an empty invalidation reason', async () => {
    const { client } = mockClient([record])
    const repo = new SupabaseKnowledgeRepository(client)
    await expect(repo.invalidate(record.id, '   ')).rejects.toThrow('Knowledge invalidation reason is required')
  })

  it('rejects a revised record with a mismatched id', async () => {
    const { client } = mockClient([record])
    const repo = new SupabaseKnowledgeRepository(client)
    await expect(repo.revise(record.id, { ...record, id: 'other' })).rejects.toThrow('Revised knowledge record id must match the existing id')
  })

  it('propagates Supabase errors with operation context', async () => {
    const client = { from: () => ({ upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: 'db unavailable' } }) }) }) }) } as unknown as KnowledgeSupabaseClient
    const repo = new SupabaseKnowledgeRepository(client)
    await expect(repo.ingest(record)).rejects.toThrow('KNOWLEDGE_INGEST_FAILED:db unavailable')
  })
})
