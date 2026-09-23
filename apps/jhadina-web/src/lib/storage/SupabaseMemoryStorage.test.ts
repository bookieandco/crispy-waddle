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
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "jhadina_retire_memory") {
        const row = table("jhadina_memories").rows.find(
          (item) =>
            item.id === args.p_memory_id &&
            item.user_id === args.p_user_id &&
            item.status === "APPROVED",
        )
        if (!row) return { data: null, error: { message: "JHADINA_MEMORY_RETIRE_TARGET_INVALID" } }
        Object.assign(row, {
          status: "RETIRED",
          revoked_at: args.p_revoked_at,
          revocation_reason: args.p_reason,
        })
        return { data: { ...row }, error: null }
      }

      if (name === "jhadina_correct_memory") {
        const rows = table("jhadina_memories").rows
        const old = rows.find(
          (item) =>
            item.id === args.p_memory_id &&
            item.user_id === args.p_user_id &&
            item.status === "APPROVED",
        )
        if (!old) return { data: null, error: { message: "JHADINA_MEMORY_CORRECTION_TARGET_INVALID" } }

        Object.assign(old, {
          status: "RETIRED",
          revoked_at: args.p_corrected_at,
          revocation_reason: "corrected",
        })
        const replacement = {
          id: args.p_new_memory_id,
          user_id: old.user_id,
          type: old.type,
          status: "APPROVED",
          content: args.p_content,
          confidence: args.p_confidence,
          created_at: args.p_corrected_at,
          approved_at: args.p_corrected_at,
          rejected_at: null,
          reasoning_event_id: args.p_reasoning_event_id,
          revoked_at: null,
          revocation_reason: null,
          supersedes_memory_id: old.id,
        }
        rows.push(replacement)
        return {
          data: [{
            retired: { ...old },
            replacement: { ...replacement },
          }],
          error: null,
        }
      }

      return { data: null, error: { message: `unexpected rpc: ${name}` } }
    },
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
      reasoningEventId: "reason_1",
    })

    expect(memory.id).toMatch(/^mem_/)
    expect(tables.jhadina_memories.rows).toHaveLength(1)

    const retrieved = await storage.getMemory(memory.id)
    expect(retrieved?.content).toBe("Loves cinematic visuals")
    expect(retrieved?.approvedAt).toBe("2026-01-01T00:00:01.000Z")
    expect(retrieved?.reasoningEventId).toBe("reason_1")
    expect(tables.jhadina_memories.rows[0]?.reasoning_event_id).toBe("reason_1")
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

  it("retires active Memory durably across adapter restart", async () => {
    const fake = makeFakeClient()
    const first = new SupabaseMemoryStorage(fake.client)
    const memory = await first.createMemory({
      userId: "user_lifecycle",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "Keep it direct.",
      confidence: 1,
      createdAt: "2026-09-22T20:00:00.000Z",
      approvedAt: "2026-09-22T20:00:00.000Z",
      reasoningEventId: "reason-direct",
    })

    const retired = await first.retireMemory(
      memory.id,
      "user_lifecycle",
      "forgotten",
      "2026-09-22T20:01:00.000Z",
    )
    expect(retired).toMatchObject({
      id: memory.id,
      status: "RETIRED",
      content: "Keep it direct.",
      revocationReason: "forgotten",
    })

    const restarted = new SupabaseMemoryStorage(fake.client)
    const fetched = await restarted.getMemory(memory.id)
    expect(fetched).toMatchObject({
      status: "RETIRED",
      content: "Keep it direct.",
      revocationReason: "forgotten",
    })
  })

  it("corrects by appending a durable superseding revision", async () => {
    const fake = makeFakeClient()
    const first = new SupabaseMemoryStorage(fake.client)
    const original = await first.createMemory({
      userId: "user_lifecycle",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "Keep it direct.",
      confidence: 0.9,
      createdAt: "2026-09-22T20:00:00.000Z",
      approvedAt: "2026-09-22T20:00:00.000Z",
      reasoningEventId: "reason-direct",
    })

    const corrected = await first.correctMemory({
      memoryId: original.id,
      userId: "user_lifecycle",
      content: "Keep it concise.",
      confidence: 1,
      reasoningEventId: "reason-concise",
      correctedAt: "2026-09-22T20:02:00.000Z",
    })

    expect(corrected.retired).toMatchObject({
      id: original.id,
      status: "RETIRED",
      content: "Keep it direct.",
      revocationReason: "corrected",
    })
    expect(corrected.replacement).toMatchObject({
      status: "APPROVED",
      content: "Keep it concise.",
      supersedesMemoryId: original.id,
      reasoningEventId: "reason-concise",
    })

    const restarted = new SupabaseMemoryStorage(fake.client)
    expect((await restarted.getMemory(original.id))?.status).toBe("RETIRED")
    const active = (await restarted.listMemories("user_lifecycle")).filter(
      (item) => item.status === "APPROVED",
    )
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({
      content: "Keep it concise.",
      supersedesMemoryId: original.id,
    })
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
      actor: "user",
      outcome: "feedback:reinforced",
      correlationId: "corr-1",
      causationId: "reason-parent",
      metadata: { kind: "personality-outcome-feedback", authority: "learning-only" },
    })

    const fetched = await storage.getReasoningEvent(event.id)
    expect(fetched?.observation.raw).toBe("I prefer cinematic visuals")
    expect(fetched?.classification.type).toBe("PREFERENCE")
    expect(fetched?.actor).toBe("user")
    expect(fetched?.outcome).toBe("feedback:reinforced")
    expect(fetched?.correlationId).toBe("corr-1")
    expect(fetched?.causationId).toBe("reason-parent")
    expect(fetched?.metadata).toMatchObject({ kind: "personality-outcome-feedback" })
    expect(tables.jhadina_reasoning_events.rows[0]).toMatchObject({
      actor: "user",
      outcome: "feedback:reinforced",
      correlation_id: "corr-1",
      causation_id: "reason-parent",
    })
  })

  it("survives a storage-adapter restart with outcome lineage intact", async () => {
    const fake = makeFakeClient()
    const first = new SupabaseMemoryStorage(fake.client)
    const event = await first.createReasoningEvent({
      userId: "user_restart",
      timestamp: "2026-09-20T22:00:00.000Z",
      userMessage: "Feedback: that response worked.",
      observation: {
        raw: "Feedback: that response worked.",
        extracted: "Feedback: that response worked.",
        timestamp: "2026-09-20T22:00:00.000Z",
      },
      classification: { type: "CONTEXT", confidence: 1 },
      systemResponse: "Feedback recorded.",
      confidence: 1,
      actor: "user",
      outcome: "feedback:reinforced",
      correlationId: "corr-restart",
      causationId: "reason-original",
      metadata: { personalityFeedbackId: "feedback-restart", authority: "learning-only" },
    })

    const restarted = new SupabaseMemoryStorage(fake.client)
    const fetched = await restarted.getReasoningEvent(event.id)
    expect(fetched).toMatchObject({
      id: event.id,
      outcome: "feedback:reinforced",
      correlationId: "corr-restart",
      causationId: "reason-original",
      metadata: { personalityFeedbackId: "feedback-restart", authority: "learning-only" },
    })
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
