import { describe, expect, it } from "vitest"
import type { JanetRegretContextProvider } from "../intelligence/janet-regret-context"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, type ContextBuilderDeps } from "./context-builder"

function freshDeps(): ContextBuilderDeps {
  const storage = new InMemoryStorage()
  return {
    memoryRepo: new MemoryRepository(storage),
    timelineRepo: new TimelineRepository(storage),
  }
}

function providerFor(regrets: Array<{
  memoryId: string
  score: number
  record: {
    regret: {
      subjectType: "prediction" | "recommendation" | "decision" | "action" | "process"
      subjectId: string
      discrepancy: string
      rootCause?: string
      recurrenceCount: number
      status: string
    }
    salience: number
  }
}>): JanetRegretContextProvider {
  return {
    getRegretContext: ({ limit }) => ({
      query: "",
      regrets: regrets.slice(0, limit ?? 5),
    }),
  }
}

describe("Context Builder regret boundary (REGRET-007)", () => {
  it("includes bounded regret signals as separate context without converting them into memories or knowledge", async () => {
    const deps = freshDeps()
    deps.regretContextProvider = providerFor([
      {
        memoryId: "regret-1",
        score: 0.91,
        record: {
          regret: {
            subjectType: "decision",
            subjectId: "decision-1",
            discrepancy: "Expected approval; actual rejection",
            rootCause: "missing verification",
            recurrenceCount: 2,
            status: "verified",
          },
          salience: 0.8,
        },
      },
    ])

    const assembled = await buildContext(deps, {
      userId: "user-a",
      activeTask: "review the decision",
      limits: { maxRegrets: 1 },
    })

    expect(assembled.contextPacket.regretContext).toHaveLength(1)
    expect(assembled.contextPacket.regretContext?.[0]).toEqual({
      memoryId: "regret-1",
      score: 0.91,
      subjectType: "decision",
      subjectId: "decision-1",
      discrepancy: "Expected approval; actual rejection",
      rootCause: "missing verification",
      recurrenceCount: 2,
      status: "verified",
      salience: 0.8,
    })
    expect(assembled.contextPacket.relevantMemories).toEqual([])
    expect(assembled.contextPacket.knowledge).toEqual([])
  })

  it("enforces the regret count boundary", async () => {
    const deps = freshDeps()
    deps.regretContextProvider = providerFor([
      {
        memoryId: "regret-1",
        score: 0.9,
        record: { regret: { subjectType: "action", subjectId: "a1", discrepancy: "d1", recurrenceCount: 1, status: "verified" }, salience: 0.5 },
      },
      {
        memoryId: "regret-2",
        score: 0.8,
        record: { regret: { subjectType: "action", subjectId: "a2", discrepancy: "d2", recurrenceCount: 1, status: "verified" }, salience: 0.5 },
      },
      {
        memoryId: "regret-3",
        score: 0.7,
        record: { regret: { subjectType: "action", subjectId: "a3", discrepancy: "d3", recurrenceCount: 1, status: "verified" }, salience: 0.5 },
      },
    ])

    const assembled = await buildContext(deps, {
      userId: "user-b",
      activeTask: "review actions",
      limits: { maxRegrets: 2 },
    })

    expect(assembled.contextPacket.regretContext).toHaveLength(2)
    expect(assembled.contextPacket.regretContext?.map((r) => r.memoryId)).toEqual(["regret-1", "regret-2"])
    expect(assembled.contextPacket.excludedContext.some((entry) => entry.includes("regret signal(s) excluded"))).toBe(true)
  })

  it("preserves an explicit no-regret state when the provider returns none", async () => {
    const deps = freshDeps()
    deps.regretContextProvider = providerFor([])

    const assembled = await buildContext(deps, {
      userId: "user-c",
      activeTask: "hello",
    })

    expect(assembled.contextPacket.regretContext).toEqual([])
  })

  it("does not assemble regret context when no provider is supplied", async () => {
    const assembled = await buildContext(freshDeps(), {
      userId: "user-d",
      activeTask: "hello",
    })

    expect(assembled.contextPacket.regretContext).toEqual([])
    expect(assembled.contextPacket.excludedContext).toContain(
      "regrets: not assembled — no RegretContextProvider supplied",
    )
  })

  it("passes the verified userId and bounded query to the provider", async () => {
    const deps = freshDeps()
    let received: { userId: string; query: string; limit?: number } | undefined
    deps.regretContextProvider = {
      getRegretContext: (params) => {
        received = params
        return { query: params.query, regrets: [] }
      },
    }

    await buildContext(deps, {
      userId: "user-e",
      activeTask: "review my trading decision",
      regretRelevanceQuery: "trading decision",
      limits: { maxRegrets: 3 },
    })

    expect(received).toEqual({ userId: "user-e", query: "trading decision", limit: 3 })
  })
})
