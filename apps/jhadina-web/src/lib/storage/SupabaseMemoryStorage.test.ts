import { describe, it, expect, beforeEach } from "vitest"
import { SupabaseMemoryStorage } from "./SupabaseMemoryStorage"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A minimal, real (not mocked) in-memory implementation of just the
 * fluent query-builder surface SupabaseMemoryStorage actually calls —
 * insert/select/update/delete with .eq/.order/.limit/.maybeSingle. This
 * proves SupabaseMemoryStorage's own row-mapping and call composition are
 * correct without a network dependency, following the same
 * fake-over-mock convention used elsewhere in this repo (e.g.
 * money-core's plaid-read-only-adapter.test.ts fakes fetch rather than
 * mocking the adapter).
 */
class FakeTable {
  rows: Record<string, unknown>[] = []
}

function makeFakeClient(): { client: SupabaseClient; tables: Record<string, FakeTable> } {
  const tables: Record<string, FakeTable> = {}
  const table = (name: string) => (tables[name] ??= new FakeTable())

  const client = {
    from(name: string) {
      const filters: Array<[string, unknown]> = []
      let orderBy: { column: string; ascending: boolean } | null = null
      let limitTo: number | null = null

      const apply = (rows: Record<string, unknown>[]) => {
        let result = rows.filter((row) => filters.every(([col, val]) => row[col] === val))
        if (orderBy) {
          const { column, ascending } = orderBy
          result = [...result].sort((a, b) => {
            const av = String(a[column])
            const bv = String(b[column])
            return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
          })
        }
        if (limitTo !== null) result = result.slice(0, limitTo)
        return result
      }

      const builder = {
        insert(row: Record<string, unknown>) {
          table(name).rows.push(row)
          return Promise.resolve({ data: null, error: null })
        },
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          filters.push([col, val])
          return builder
        },
        order(column: string, opts: { ascending: boolean }) {
          orderBy = { column, ascending: opts.ascending }
          return builder
        },
        limit(n: number) {
          limitTo = n
          return builder
        },
        async maybeSingle() {
          const matches = apply(table(name).rows)
          return { data: matches[0] ?? null, error: null }
        },
        update(patch: Record<string, unknown>) {
          const matches = apply(table(name).rows)
          matches.forEach((row) => Object.assign(row, patch))
          return builder
        },
        delete() {
          return {
            eq(col: string, val: unknown) {
              table(name).rows = table(name).rows.filter((row) => row[col] !== val)
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: apply(table(name).rows), error: null }))
        },
      }
      return builder
    },
  }

  return { client: client as unknown as SupabaseClient, tables }
}

describe("SupabaseMemoryStorage", () => {
  let storage: SupabaseMemoryStorage
  let tables: Record<string, FakeTable>

  beforeEach(() => {
    const fake = makeFakeClient()
    tables = fake.tables
    storage = new SupabaseMemoryStorage(fake.client)
  })

  it("creates and retrieves a memory", async () => {
    const memory = await storage.createMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "Loves cinematic visuals",
      confidence: 0.95,
      createdAt: "2026-01-01T00:00:00.000Z",
      approvedAt: "2026-01-01T00:00:01.000Z",
    })

    expect(memory.id).toMatch(/^mem_/)
    expect(tables.jhadina_memories.rows).toHaveLength(1)

    const retrieved = await storage.getMemory(memory.id)
    expect(retrieved?.content).toBe("Loves cinematic visuals")
    expect(retrieved?.approvedAt).toBe("2026-01-01T00:00:01.000Z")
  })

  it("scopes listMemories to the requesting user", async () => {
    await storage.createMemory({
      userId: "user_1", type: "PREFERENCE", status: "APPROVED",
      content: "A", confidence: 0.9, createdAt: "2026-01-01T00:00:00.000Z",
    })
    await storage.createMemory({
      userId: "user_2", type: "GOAL", status: "APPROVED",
      content: "B", confidence: 0.9, createdAt: "2026-01-01T00:00:00.000Z",
    })

    const user1 = await storage.listMemories("user_1")
    expect(user1).toHaveLength(1)
    expect(user1[0].content).toBe("A")
  })

  it("creates a candidate, then removes it on approval (mirroring MemoryRepository.approve)", async () => {
    const candidate = await storage.createCandidate({
      userId: "user_1",
      content: "I prefer cinematic visuals",
      type: "PREFERENCE",
      confidence: 0.95,
      status: "PENDING",
      createdAt: "2026-01-01T00:00:00.000Z",
      reasoningEventId: "reason_1",
    })

    expect(candidate.id).toMatch(/^cand_/)
    expect(await storage.listCandidates("user_1", "PENDING")).toHaveLength(1)

    await storage.removeCandidate(candidate.id)
    expect(await storage.getCandidate(candidate.id)).toBeUndefined()
    expect(await storage.listCandidates("user_1", "PENDING")).toHaveLength(0)
  })

  it("round-trips a reasoning event including nested jsonb fields", async () => {
    const event = await storage.createReasoningEvent({
      userId: "user_1",
      timestamp: "2026-01-01T00:00:00.000Z",
      userMessage: "I prefer cinematic visuals",
      observation: { raw: "I prefer cinematic visuals", extracted: "I prefer cinematic visuals", timestamp: "2026-01-01T00:00:00.000Z" },
      classification: { type: "PREFERENCE", confidence: 0.95 },
      systemResponse: "Noted",
      confidence: 0.95,
    })

    const fetched = await storage.getReasoningEvent(event.id)
    expect(fetched?.observation.raw).toBe("I prefer cinematic visuals")
    expect(fetched?.classification.type).toBe("PREFERENCE")
  })

  it("round-trips a timeline event including memoryContent", async () => {
    await storage.appendTimelineEvent({
      userId: "user_1",
      timestamp: "2026-01-01T00:00:01.000Z",
      type: "APPROVAL",
      memoryId: "mem_1",
      memoryType: "PREFERENCE",
      memoryContent: "Loves cinematic visuals",
      decision: "APPROVED",
    })

    const timeline = await storage.listTimeline("user_1")
    expect(timeline).toHaveLength(1)
    expect(timeline[0].memoryContent).toBe("Loves cinematic visuals")
    expect(timeline[0].decision).toBe("APPROVED")
  })

  it("throws a tagged error when the client reports a failure", async () => {
    const failing = {
      from() {
        return {
          insert: async () => ({ data: null, error: { message: "connection refused" } }),
        }
      },
    } as unknown as SupabaseClient
    const failingStorage = new SupabaseMemoryStorage(failing)

    await expect(
      failingStorage.createMemory({
        userId: "user_1", type: "PREFERENCE", status: "APPROVED",
        content: "x", confidence: 0.9, createdAt: "2026-01-01T00:00:00.000Z",
      })
    ).rejects.toThrow(/JHADINA_MEMORY_STORAGE_FAILED:createMemory:connection refused/)
  })
})
