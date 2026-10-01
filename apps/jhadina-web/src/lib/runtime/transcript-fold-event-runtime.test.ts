import { describe, expect, it } from "vitest"
import type { DomainEvent, EventBus } from "@jhadina/event-bus"
import { prepareTranscriptFoldEventEmitter, parseTranscriptFoldRuntimeTrace } from "./transcript-fold-event-runtime"

class MemoryBus implements EventBus {
  readonly events: DomainEvent<unknown>[] = []
  async publish<T>(event: DomainEvent<T>) {
    this.events.push(event as DomainEvent<unknown>)
  }
  subscribe<T>(_type: string, _handler: (event: DomainEvent<T>) => void | Promise<void>) {
    return () => {}
  }
}

const activeSession = {
  id: "ws:1",
  ownerUserId: "user:1",
  goal: "prove one commercial loop",
  status: "active" as const,
  activeSubsystems: [],
  artifactRefs: [],
  decisionRefs: [],
  outputRefs: [],
  createdAt: "2026-09-28T19:00:00.000Z",
  updatedAt: "2026-09-28T19:00:00.000Z",
}

describe("transcript fold event runtime", () => {
  it("requires an owned open work session and emits authority-free durable events", async () => {
    const bus = new MemoryBus()
    const emitter = await prepareTranscriptFoldEventEmitter({
      userId: "user:1",
      runtime: { workSessionId: "ws:1", correlationId: "corr:1" },
    }, {
      sessionReader: { get: async () => activeSession },
      bus,
    })

    await emitter.emit({
      type: "commercial.market_learning.observed",
      entityId: "learning:1",
      occurredAt: "2026-09-28T19:01:00.000Z",
      payload: {
        recordId: "learning:1",
        opportunityId: "opp:1",
        commitmentLevel: "paid",
        evidenceRefs: ["receipt:1"],
      },
    })

    expect(bus.events).toHaveLength(1)
    expect(bus.events[0].context?.actorId).toBe("user:1")
    expect(bus.events[0].context?.authorityRef).toBeUndefined()
  })

  it("rejects a closed work session", async () => {
    await expect(prepareTranscriptFoldEventEmitter({
      userId: "user:1",
      runtime: { workSessionId: "ws:1", correlationId: "corr:1" },
    }, {
      sessionReader: { get: async () => ({ ...activeSession, status: "completed" as const }) },
      bus: new MemoryBus(),
    })).rejects.toThrow("WORK_SESSION_CLOSED")
  })

  it("rejects a task correlation fork", async () => {
    await expect(prepareTranscriptFoldEventEmitter({
      userId: "user:1",
      runtime: { workSessionId: "ws:1", taskId: "task:1", correlationId: "wrong" },
    }, {
      sessionReader: { get: async () => activeSession },
      taskReader: {
        get: async () => ({
          id: "task:1",
          workSessionId: "ws:1",
          ownerUserId: "user:1",
          domain: "opportunity",
          capability: "opportunity.commercial-learning",
          status: "running",
          authorityRef: "authority:none",
          idempotencyKey: "task:1",
          correlationId: "corr:real",
          dependencyIds: [],
          inputRefs: [],
          outputRefs: [],
          attempt: 1,
          maxAttempts: 3,
          version: 1,
          createdAt: "2026-09-28T19:00:00.000Z",
          updatedAt: "2026-09-28T19:00:00.000Z",
        }),
      },
      bus: new MemoryBus(),
    })).rejects.toThrow("CORRELATION_MISMATCH")
  })

  it("parses only traceable runtime context", () => {
    expect(parseTranscriptFoldRuntimeTrace({
      workSessionId: " ws:1 ",
      correlationId: " corr:1 ",
    })).toEqual({
      workSessionId: "ws:1",
      correlationId: "corr:1",
      taskId: undefined,
      causationId: undefined,
    })
    expect(() => parseTranscriptFoldRuntimeTrace({})).toThrow("WORK_SESSION_REQUIRED")
  })
})
