import { describe, expect, it } from "vitest"
import {
  DurableEventBus,
  InMemoryEventConsumerCheckpointStore,
  InMemoryEventJournal,
  TRANSCRIPT_FOLD_EVENT_TYPES,
  createTranscriptFoldEvent,
} from "@jhadina/event-bus"
import { drainTranscriptFoldLearningEvents } from "./transcript-fold-learning-consumer"

const session = {
  id: "ws:1",
  ownerUserId: "user:1",
  goal: "prove one revenue loop",
  status: "active" as const,
  activeSubsystems: [],
  artifactRefs: [],
  decisionRefs: [],
  outputRefs: [],
  createdAt: "2026-09-28T19:00:00.000Z",
  updatedAt: "2026-09-28T19:00:00.000Z",
}

async function harness(commitmentLevel: string) {
  const journal = new InMemoryEventJournal()
  const checkpoints = new InMemoryEventConsumerCheckpointStore()
  const bus = new DurableEventBus(journal)

  await bus.publish(createTranscriptFoldEvent({
    type: TRANSCRIPT_FOLD_EVENT_TYPES.MARKET_LEARNING_OBSERVED,
    entityId: "learning:1",
    occurredAt: "2026-09-28T19:01:00.000Z",
    payload: {
      recordId: "learning:1",
      opportunityId: "opp:1",
      commitmentLevel,
      evidenceRefs: ["evidence:1"],
    },
    runtime: {
      workSessionId: "ws:1",
      correlationId: "corr:1",
      actorId: "user:1",
    },
  }))

  return { journal, checkpoints, bus }
}

describe("transcript fold learning consumer", () => {
  it("turns paid market evidence into a content candidate and focus reassessment", async () => {
    const h = await harness("paid")
    const first = await drainTranscriptFoldLearningEvents({
      userId: "user:1",
      workSessionId: "ws:1",
    }, {
      sessionReader: { get: async () => session },
      journal: h.journal,
      checkpoints: h.checkpoints,
      bus: h.bus,
    })

    expect(first.processed).toBe(1)
    expect(first.derivedEvents).toBe(2)

    const events = await h.journal.listByWorkSession("ws:1")
    expect(events.map((event) => event.type)).toEqual([
      TRANSCRIPT_FOLD_EVENT_TYPES.MARKET_LEARNING_OBSERVED,
      TRANSCRIPT_FOLD_EVENT_TYPES.FOCUS_REASSESSMENT_REQUESTED,
      TRANSCRIPT_FOLD_EVENT_TYPES.GROWTH_CONTENT_CANDIDATE_PROPOSED,
    ])
  })

  it("does not create a content candidate from attention-only evidence", async () => {
    const h = await harness("attention")
    const result = await drainTranscriptFoldLearningEvents({
      userId: "user:1",
      workSessionId: "ws:1",
    }, {
      sessionReader: { get: async () => session },
      journal: h.journal,
      checkpoints: h.checkpoints,
      bus: h.bus,
    })

    expect(result.derivedEvents).toBe(1)
    const events = await h.journal.listByWorkSession("ws:1")
    expect(events.some((event) => event.type === TRANSCRIPT_FOLD_EVENT_TYPES.GROWTH_CONTENT_CANDIDATE_PROPOSED)).toBe(false)
  })

  it("replay is idempotent across derived events and checkpoints", async () => {
    const h = await harness("paid")
    await drainTranscriptFoldLearningEvents({
      userId: "user:1",
      workSessionId: "ws:1",
    }, {
      sessionReader: { get: async () => session },
      journal: h.journal,
      checkpoints: h.checkpoints,
      bus: h.bus,
    })

    const second = await drainTranscriptFoldLearningEvents({
      userId: "user:1",
      workSessionId: "ws:1",
    }, {
      sessionReader: { get: async () => session },
      journal: h.journal,
      checkpoints: h.checkpoints,
      bus: h.bus,
    })

    expect(second.processed).toBe(2)
    expect(second.derivedEvents).toBe(0)

    const third = await drainTranscriptFoldLearningEvents({
      userId: "user:1",
      workSessionId: "ws:1",
    }, {
      sessionReader: { get: async () => session },
      journal: h.journal,
      checkpoints: h.checkpoints,
      bus: h.bus,
    })
    expect(third.processed).toBe(0)
  })
})
