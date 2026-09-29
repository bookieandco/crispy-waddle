import {
  DurableEventBus,
  SupabaseEventConsumerCheckpointStore,
  SupabaseEventJournal,
  TRANSCRIPT_FOLD_EVENT_TYPES,
  consumeReplayBatch,
  createTranscriptFoldEvent,
  type DomainEvent,
  type EventBus,
  type EventConsumerCheckpointStore,
  type EventJournal,
  type RuntimeEventDatabaseClient,
} from "@jhadina/event-bus"
import { commitmentRank } from "@jhadina/opportunity-core"
import { buildWorkToContentCandidate } from "@jhadina/growth-core"
import type { JhadinaWorkSession } from "@jhadina/core-spine"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { SupabaseWorkSessionRepository } from "@/lib/work-session/supabase-work-session-repository"

const CONSUMER_ID = "transcript-fold-learning-v1"

type WorkSessionReader = {
  get(id: string): Promise<JhadinaWorkSession | null>
}

export async function drainTranscriptFoldLearningEvents(input: {
  userId: string
  workSessionId: string
  limit?: number
}, overrides: {
  sessionReader?: WorkSessionReader
  journal?: EventJournal
  checkpoints?: EventConsumerCheckpointStore
  bus?: EventBus
} = {}): Promise<{
  processed: number
  checkpoint: number
  derivedEvents: number
}> {
  if (!input.userId.trim()) throw new Error("TRANSCRIPT_REPLAY_USER_REQUIRED")
  if (!input.workSessionId.trim()) throw new Error("TRANSCRIPT_REPLAY_WORK_SESSION_REQUIRED")

  let sessionReader = overrides.sessionReader
  let journal = overrides.journal
  let checkpoints = overrides.checkpoints
  let bus = overrides.bus

  if (!sessionReader || !journal || !checkpoints || !bus) {
    const client = createServiceRoleClient()
    if (!client) throw new Error("TRANSCRIPT_REPLAY_EVENT_STORE_NOT_CONFIGURED")
    const db = client as unknown as RuntimeEventDatabaseClient
    sessionReader ??= new SupabaseWorkSessionRepository(client, input.userId)
    journal ??= new SupabaseEventJournal(db)
    checkpoints ??= new SupabaseEventConsumerCheckpointStore(db)
    bus ??= new DurableEventBus(journal)
  }

  const session = await sessionReader.get(input.workSessionId)
  if (!session || session.ownerUserId !== input.userId) {
    throw new Error("TRANSCRIPT_REPLAY_WORK_SESSION_NOT_FOUND")
  }
  if (session.status === "abandoned") {
    throw new Error("TRANSCRIPT_REPLAY_WORK_SESSION_ABANDONED")
  }

  let derivedEvents = 0
  const result = await consumeReplayBatch({
    journal,
    checkpoints,
    consumerId: CONSUMER_ID,
    workSessionId: input.workSessionId,
    limit: input.limit ?? 100,
    handle: async (entry) => {
      derivedEvents += await deriveFromEvent(entry.event, bus!)
    },
  })

  return { ...result, derivedEvents }
}

async function deriveFromEvent(event: DomainEvent<unknown>, bus: EventBus): Promise<number> {
  if (!event.context) return 0

  if (event.type === TRANSCRIPT_FOLD_EVENT_TYPES.MARKET_LEARNING_OBSERVED) {
    const payload = asObject(event.payload)
    const recordId = text(payload.recordId)
    const opportunityId = text(payload.opportunityId)
    const commitmentLevel = text(payload.commitmentLevel)
    const evidenceRefs = strings(payload.evidenceRefs)
    let emitted = 0

    const focusEvent = createTranscriptFoldEvent({
      type: TRANSCRIPT_FOLD_EVENT_TYPES.FOCUS_REASSESSMENT_REQUESTED,
      entityId: `market-learning:${recordId}`,
      occurredAt: event.occurredAt,
      payload: {
        sourceEventId: event.id,
        reason: `New market evidence reached ${commitmentLevel || "unknown"} commitment.`,
        objectiveRef: opportunityId || undefined,
        evidenceRefs,
      },
      runtime: childRuntime(event),
    })
    await bus.publish(focusEvent)
    emitted += 1

    if (commitmentLevel && commitmentRank(commitmentLevel as Parameters<typeof commitmentRank>[0]) >= commitmentRank("paid")) {
      const candidate = buildWorkToContentCandidate({
        event: {
          id: `work-event:${event.id}`,
          kind: "experiment",
          projectId: opportunityId,
          summary: `Market evidence reached ${commitmentLevel} commitment.`,
          happenedAt: event.occurredAt,
          evidenceRefs,
          publishable: true,
          containsSensitiveData: false,
        },
        angle: `What we learned from a real ${commitmentLevel} market commitment`,
      })

      const contentEvent = createTranscriptFoldEvent({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.GROWTH_CONTENT_CANDIDATE_PROPOSED,
        entityId: candidate.id,
        occurredAt: event.occurredAt,
        payload: {
          candidateId: candidate.id,
          sourceEventId: event.id,
          projectId: candidate.projectId,
          origin: candidate.origin,
          angle: candidate.angle,
          evidenceRefs: candidate.evidenceRefs,
          requiresRedaction: candidate.requiresRedaction,
        },
        runtime: childRuntime(event),
      })
      await bus.publish(contentEvent)
      emitted += 1
    }

    return emitted
  }

  if (event.type === TRANSCRIPT_FOLD_EVENT_TYPES.RECURRING_OFFER_ASSESSED) {
    const payload = asObject(event.payload)
    const recordId = text(payload.recordId)
    const eventToPublish = createTranscriptFoldEvent({
      type: TRANSCRIPT_FOLD_EVENT_TYPES.FOCUS_REASSESSMENT_REQUESTED,
      entityId: `recurring-offer:${recordId}`,
      occurredAt: event.occurredAt,
      payload: {
        sourceEventId: event.id,
        reason: "Recurring-offer evidence changed.",
        objectiveRef: text(payload.opportunityId) || undefined,
        evidenceRefs: strings(payload.evidenceRefs),
      },
      runtime: childRuntime(event),
    })
    await bus.publish(eventToPublish)
    return 1
  }

  if (event.type === TRANSCRIPT_FOLD_EVENT_TYPES.SOCIAL_CANARY_RECEIPT_CAPTURED) {
    const payload = asObject(event.payload)
    const receiptId = text(payload.receiptId)
    const state = text(payload.state)
    const eventToPublish = createTranscriptFoldEvent({
      type: TRANSCRIPT_FOLD_EVENT_TYPES.FOCUS_REASSESSMENT_REQUESTED,
      entityId: `social-canary:${receiptId}`,
      occurredAt: event.occurredAt,
      payload: {
        sourceEventId: event.id,
        reason: `Social publish canary receipt is ${state || "unknown"}.`,
        evidenceRefs: strings(payload.evidenceRefs),
      },
      runtime: childRuntime(event),
    })
    await bus.publish(eventToPublish)
    return 1
  }

  return 0
}

function childRuntime(event: DomainEvent<unknown>) {
  const context = event.context!
  return {
    workSessionId: context.workSessionId,
    taskId: context.taskId,
    correlationId: context.correlationId,
    causationId: event.id,
    actorId: context.actorId ?? "system",
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : []
}
