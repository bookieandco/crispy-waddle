import {
  DurableEventBus,
  SupabaseEventJournal,
  createTranscriptFoldEvent,
  type EventBus,
  type RuntimeEventDatabaseClient,
  type TranscriptFoldEventPayloadMap,
  type TranscriptFoldEventType,
} from "@jhadina/event-bus"
import type { JhadinaWorkSession, WorkSessionTask } from "@jhadina/core-spine"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { SupabaseWorkSessionRepository } from "@/lib/work-session/supabase-work-session-repository"
import { SupabaseWorkSessionTaskRepository } from "@/lib/work-session/supabase-work-session-task-repository"

export type TranscriptFoldRuntimeTrace = {
  workSessionId: string
  taskId?: string
  correlationId: string
  causationId?: string
}

type WorkSessionReader = {
  get(id: string): Promise<JhadinaWorkSession | null>
}

type WorkSessionTaskReader = {
  get(workSessionId: string, taskId: string): Promise<WorkSessionTask | null>
}

export type TranscriptFoldEventEmitter = {
  emit<TType extends TranscriptFoldEventType>(input: {
    type: TType
    entityId: string
    occurredAt: string
    payload: TranscriptFoldEventPayloadMap[TType]
  }): Promise<void>
}

export async function prepareTranscriptFoldEventEmitter(input: {
  userId: string
  runtime: TranscriptFoldRuntimeTrace
}, overrides: {
  sessionReader?: WorkSessionReader
  taskReader?: WorkSessionTaskReader
  bus?: EventBus
} = {}): Promise<TranscriptFoldEventEmitter> {
  requireText(input.userId, "TRANSCRIPT_RUNTIME_USER_REQUIRED")
  requireText(input.runtime.workSessionId, "TRANSCRIPT_RUNTIME_WORK_SESSION_REQUIRED")
  requireText(input.runtime.correlationId, "TRANSCRIPT_RUNTIME_CORRELATION_REQUIRED")

  let sessionReader = overrides.sessionReader
  let taskReader = overrides.taskReader
  let bus = overrides.bus

  if (!sessionReader || (input.runtime.taskId && !taskReader) || !bus) {
    const client = createServiceRoleClient()
    if (!client) throw new Error("TRANSCRIPT_RUNTIME_EVENT_STORE_NOT_CONFIGURED")
    sessionReader ??= new SupabaseWorkSessionRepository(client, input.userId)
    taskReader ??= new SupabaseWorkSessionTaskRepository(client, input.userId)
    bus ??= new DurableEventBus(
      new SupabaseEventJournal(client as unknown as RuntimeEventDatabaseClient),
    )
  }

  const session = await sessionReader.get(input.runtime.workSessionId)
  if (!session || session.ownerUserId !== input.userId) {
    throw new Error("TRANSCRIPT_RUNTIME_WORK_SESSION_NOT_FOUND")
  }
  if (session.status === "completed" || session.status === "abandoned") {
    throw new Error("TRANSCRIPT_RUNTIME_WORK_SESSION_CLOSED")
  }

  if (input.runtime.taskId) {
    const task = await taskReader!.get(input.runtime.workSessionId, input.runtime.taskId)
    if (!task || task.ownerUserId !== input.userId) {
      throw new Error("TRANSCRIPT_RUNTIME_TASK_NOT_FOUND")
    }
    if (task.correlationId !== input.runtime.correlationId) {
      throw new Error("TRANSCRIPT_RUNTIME_CORRELATION_MISMATCH")
    }
  }

  return Object.freeze({
    async emit<TType extends TranscriptFoldEventType>(eventInput: {
      type: TType
      entityId: string
      occurredAt: string
      payload: TranscriptFoldEventPayloadMap[TType]
    }): Promise<void> {
      const event = createTranscriptFoldEvent({
        ...eventInput,
        runtime: {
          workSessionId: input.runtime.workSessionId,
          taskId: input.runtime.taskId,
          correlationId: input.runtime.correlationId,
          causationId: input.runtime.causationId,
          actorId: input.userId,
        },
      })
      await bus!.publish(event)
    },
  })
}

export function parseTranscriptFoldRuntimeTrace(value: unknown): TranscriptFoldRuntimeTrace {
  if (!value || typeof value !== "object") {
    throw new Error("TRANSCRIPT_RUNTIME_CONTEXT_REQUIRED")
  }
  const record = value as Record<string, unknown>
  const workSessionId = typeof record.workSessionId === "string" ? record.workSessionId.trim() : ""
  const taskId = typeof record.taskId === "string" ? record.taskId.trim() : ""
  const correlationId = typeof record.correlationId === "string" ? record.correlationId.trim() : ""
  const causationId = typeof record.causationId === "string" ? record.causationId.trim() : ""
  if (!workSessionId) throw new Error("TRANSCRIPT_RUNTIME_WORK_SESSION_REQUIRED")
  if (!correlationId) throw new Error("TRANSCRIPT_RUNTIME_CORRELATION_REQUIRED")
  return Object.freeze({
    workSessionId,
    taskId: taskId || undefined,
    correlationId,
    causationId: causationId || undefined,
  })
}

function requireText(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code)
}
