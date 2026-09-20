import { beforeEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Experience } from "@jhadina/core-spine"
import { SupabaseMemoryStorage } from "../storage/SupabaseMemoryStorage"
import { PersistedExperiencePatternAdapter } from "./persisted-experience-pattern-adapter"

class FakeTable {
  rows: Record<string, unknown>[] = []
}

function makeFakeClient(): {
  client: SupabaseClient
  tables: Record<string, FakeTable>
} {
  const tables: Record<string, FakeTable> = {}
  const table = (name: string) => (tables[name] ??= new FakeTable())

  const client = {
    from(name: string) {
      const filters: Array<[string, unknown]> = []
      let orderBy: { column: string; ascending: boolean } | null = null
      let limitTo: number | null = null

      const apply = (rows: Record<string, unknown>[]) => {
        let result = rows.filter((row) =>
          filters.every(([column, value]) => row[column] === value),
        )

        if (orderBy) {
          const { column, ascending } = orderBy
          result = [...result].sort((left, right) => {
            const a = String(left[column])
            const b = String(right[column])
            return ascending ? a.localeCompare(b) : b.localeCompare(a)
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
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return builder
        },
        order(column: string, options: { ascending: boolean }) {
          orderBy = { column, ascending: options.ascending }
          return builder
        },
        limit(value: number) {
          limitTo = value
          return builder
        },
        async maybeSingle() {
          const rows = apply(table(name).rows)
          return { data: rows[0] ?? null, error: null }
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown) {
          return Promise.resolve(
            resolve({ data: apply(table(name).rows), error: null }),
          )
        },
      }

      return builder
    },
  }

  return {
    client: client as unknown as SupabaseClient,
    tables,
  }
}

describe("persisted Experience -> Hippocampus -> Pattern vertical", () => {
  let storage: SupabaseMemoryStorage
  let tables: Record<string, FakeTable>

  beforeEach(() => {
    const fake = makeFakeClient()
    storage = new SupabaseMemoryStorage(fake.client)
    tables = fake.tables
  })

  it("retrieves persisted reasoning events, scopes approved memory, and detects a pattern", async () => {
    const historical = await storage.createReasoningEvent({
      userId: "user_1",
      timestamp: "2026-09-01T12:00:00.000Z",
      userMessage: "I prefer direct answers when we plan.",
      observation: {
        raw: "I prefer direct answers when we plan.",
        extracted: "prefer direct answers",
        timestamp: "2026-09-01T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.95 },
      systemResponse: "Understood.",
      confidence: 0.95,
    })

    const memory = await storage.createMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "I prefer direct answers when we plan.",
      confidence: 0.95,
      createdAt: "2026-09-01T12:00:00.000Z",
      approvedAt: "2026-09-01T12:01:00.000Z",
    })

    const rejected = await storage.createMemory({
      userId: "user_1",
      type: "PREFERENCE",
      status: "REJECTED",
      content: "I prefer direct answers when we plan.",
      confidence: 0.95,
      createdAt: "2026-09-01T12:02:00.000Z",
      rejectedAt: "2026-09-01T12:03:00.000Z",
    })

    const current = await storage.createReasoningEvent({
      userId: "user_1",
      timestamp: "2026-09-02T12:00:00.000Z",
      userMessage: "Please keep this answer direct while we plan.",
      observation: {
        raw: "Please keep this answer direct while we plan.",
        extracted: "keep answer direct",
        timestamp: "2026-09-02T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.9 },
      systemResponse: "Okay.",
      confidence: 0.9,
    })

    const adapter = new PersistedExperiencePatternAdapter(storage)
    const result = await adapter.detect({
      userId: "user_1",
      experienceId: current.id,
    })

    expect(tables.jhadina_reasoning_events.rows).toHaveLength(2)
    expect(tables.jhadina_memories.rows).toHaveLength(2)

    expect(result.experience.id).toBe(current.id)
    expect(result.experience.provenance).toMatchObject({
      persistence: "jhadina_reasoning_events",
      reasoningEventId: current.id,
      userId: "user_1",
    })

    expect(result.relatedEpisodes.map((episode) => episode.episodeId)).toContain(
      current.id,
    )
    expect(result.relatedEpisodes.map((episode) => episode.episodeId)).toContain(
      historical.id,
    )

    expect(result.memories).toHaveLength(1)
    expect(result.memories[0]?.id).toBe(memory.id)
    expect(result.memories[0]?.evidence.map((item) => item.id)).toEqual([
      memory.id,
    ])
    expect(result.memories[0]?.evidence.map((item) => item.id)).not.toContain(
      rejected.id,
    )

    const direct = result.patterns.find(
      (pattern) => pattern.id === "recurrence:direct",
    )
    expect(direct).toBeDefined()
    expect(direct?.occurrences).toBe(2)
    expect(direct?.confidence).toBe(3 / 4)
    expect(direct?.personalityEligible).toBe(false)
    expect(direct?.evidence.map((item) => item.id)).toEqual([
      current.id,
      memory.id,
    ])
  })


  it("analyzes a live Experience against durable history without persisting a duplicate episode", async () => {
    const historical = await storage.createReasoningEvent({
      userId: "user_live",
      timestamp: "2026-09-01T12:00:00.000Z",
      userMessage: "I prefer direct answers when we plan.",
      observation: {
        raw: "I prefer direct answers when we plan.",
        extracted: "prefer direct answers",
        timestamp: "2026-09-01T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.95 },
      systemResponse: "Understood.",
      confidence: 0.95,
    })
    const memory = await storage.createMemory({
      userId: "user_live",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "I prefer direct answers when we plan.",
      confidence: 0.95,
      createdAt: "2026-09-01T12:00:00.000Z",
      approvedAt: "2026-09-01T12:01:00.000Z",
    })
    const live: Experience = {
      id: "live-command-1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      source: "ask-jhadina",
      actor: "user",
      content: "Please keep this answer direct while we plan.",
      evidence: [{
        id: "live-command-1",
        source: "ask-jhadina",
        observedAt: "2026-09-02T12:00:00.000Z",
        summary: "Please keep this answer direct while we plan.",
        immutable: false,
      }],
    }

    const adapter = new PersistedExperiencePatternAdapter(storage)
    const result = await adapter.detectExperience({
      userId: "user_live",
      experience: live,
    })

    expect(tables.jhadina_reasoning_events.rows).toHaveLength(1)
    expect(result.experience.id).toBe("live-command-1")
    expect(result.relatedEpisodes.map((episode) => episode.episodeId)).toContain(
      historical.id,
    )
    expect(result.memories.map((proposal) => proposal.id)).toEqual([memory.id])

    const direct = result.patterns.find(
      (pattern) => pattern.id === "recurrence:direct",
    )
    expect(direct).toBeDefined()
    expect(direct?.personalityEligible).toBe(false)
    expect(direct?.evidence.map((item) => item.id)).toEqual([
      "live-command-1",
      memory.id,
    ])
  })

  it("uses retrieved Hippocampal episodes as direct Pattern evidence without synthesizing approved memory", async () => {
    const historical = await storage.createReasoningEvent({
      userId: "user_episode",
      timestamp: "2026-09-01T12:00:00.000Z",
      userMessage: "Keep answers direct when we plan.",
      observation: {
        raw: "Keep answers direct when we plan.",
        extracted: "keep answers direct",
        timestamp: "2026-09-01T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.9 },
      systemResponse: "Understood.",
      confidence: 0.9,
    })

    const live: Experience = {
      id: "live-episode-1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      source: "ask-jhadina",
      actor: "user",
      content: "Please keep this direct while we plan.",
      evidence: [{
        id: "live-episode-1",
        source: "ask-jhadina",
        observedAt: "2026-09-02T12:00:00.000Z",
        summary: "Please keep this direct while we plan.",
        immutable: false,
      }],
    }

    const result = await new PersistedExperiencePatternAdapter(storage).detectExperience({
      userId: "user_episode",
      experience: live,
    })

    expect(result.memories).toEqual([])
    expect(result.patterns.some((pattern) => pattern.id === "recurrence:direct")).toBe(false)

    const episodic = result.patterns.find(
      (pattern) => pattern.id === "episodic-recurrence:direct",
    )
    expect(episodic).toBeDefined()
    expect(episodic?.occurrences).toBe(2)
    expect(episodic?.confidence).toBe(3 / 4)
    expect(episodic?.personalityEligible).toBe(false)
    expect(episodic?.evidence.map((item) => item.id)).toEqual([
      "live-episode-1",
      historical.id,
    ])
  })

  it("deduplicates only the memory-covered term from its originating Hippocampal episode", async () => {
    const historical = await storage.createReasoningEvent({
      userId: "user_lineage",
      timestamp: "2026-09-01T12:00:00.000Z",
      userMessage: "I prefer direct concise answers when we plan.",
      observation: {
        raw: "I prefer direct concise answers when we plan.",
        extracted: "prefer direct concise answers",
        timestamp: "2026-09-01T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.95 },
      systemResponse: "Understood.",
      confidence: 0.95,
    })

    const memory = await storage.createMemory({
      userId: "user_lineage",
      type: "PREFERENCE",
      status: "APPROVED",
      content: "I prefer direct answers when we plan.",
      confidence: 0.95,
      createdAt: "2026-09-01T12:00:00.000Z",
      approvedAt: "2026-09-01T12:01:00.000Z",
      reasoningEventId: historical.id,
    })

    const live: Experience = {
      id: "live-lineage-1",
      occurredAt: "2026-09-02T12:00:00.000Z",
      source: "ask-jhadina",
      actor: "user",
      content: "Please keep this direct and concise while we plan.",
      evidence: [{
        id: "live-lineage-1",
        source: "ask-jhadina",
        observedAt: "2026-09-02T12:00:00.000Z",
        summary: "Please keep this direct and concise while we plan.",
        immutable: false,
      }],
    }

    const result = await new PersistedExperiencePatternAdapter(storage).detectExperience({
      userId: "user_lineage",
      experience: live,
    })

    const memoryBacked = result.patterns.find(
      (pattern) => pattern.id === "recurrence:direct",
    )
    expect(memoryBacked).toBeDefined()
    expect(memoryBacked?.occurrences).toBe(2)
    expect(memoryBacked?.evidence.map((item) => item.id)).toEqual([
      "live-lineage-1",
      historical.id,
    ])
    expect(result.memories[0]?.id).toBe(memory.id)
    expect(
      result.patterns.some((pattern) => pattern.id === "episodic-recurrence:direct"),
    ).toBe(false)

    const concise = result.patterns.find(
      (pattern) => pattern.id === "episodic-recurrence:concise",
    )
    expect(concise).toBeDefined()
    expect(concise?.occurrences).toBe(2)
    expect(concise?.evidence.map((item) => item.id)).toEqual([
      "live-lineage-1",
      historical.id,
    ])
  })

  it("fails closed when the persisted event belongs to another user", async () => {
    const event = await storage.createReasoningEvent({
      userId: "user_2",
      timestamp: "2026-09-02T12:00:00.000Z",
      userMessage: "Keep it direct.",
      observation: {
        raw: "Keep it direct.",
        extracted: "keep it direct",
        timestamp: "2026-09-02T12:00:00.000Z",
      },
      classification: { type: "PREFERENCE", confidence: 0.9 },
      systemResponse: "Okay.",
      confidence: 0.9,
    })

    const adapter = new PersistedExperiencePatternAdapter(storage)

    await expect(
      adapter.detect({
        userId: "user_1",
        experienceId: event.id,
      }),
    ).rejects.toThrow(`JHADINA_EXPERIENCE_USER_MISMATCH:${event.id}`)
  })
})
