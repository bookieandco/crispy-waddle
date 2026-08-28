import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ExperienceEvent,
  ExperiencePort,
  ExperienceAppendResult,
} from "@jhadina/core-spine"

type ExperienceRow = {
  event_id: string
  user_id: string
  occurred_at: string
  recorded_at: string
  event_type: string
  outcome: string | null
  actor: string
  source: string
  domain: string | null
  correlation_id: string | null
  causation_id: string | null
  sensitivity: ExperienceEvent["sensitivity"]
  provenance: ExperienceEvent["provenance"]
  evidence: ExperienceEvent["evidence"]
  content: string
  metadata: ExperienceEvent["metadata"] | null
}

function sameEvent(a: ExperienceRow, b: ExperienceRow): boolean {
  return a.user_id === b.user_id &&
    a.occurred_at === b.occurred_at &&
    a.recorded_at === b.recorded_at &&
    a.event_type === b.event_type &&
    a.outcome === b.outcome &&
    a.actor === b.actor &&
    a.source === b.source &&
    a.domain === b.domain &&
    a.correlation_id === b.correlation_id &&
    a.causation_id === b.causation_id &&
    a.sensitivity === b.sensitivity &&
    JSON.stringify(a.provenance) === JSON.stringify(b.provenance) &&
    JSON.stringify(a.evidence) === JSON.stringify(b.evidence) &&
    a.content === b.content &&
    JSON.stringify(a.metadata) === JSON.stringify(b.metadata)
}

export class SupabaseExperienceRecorder implements ExperiencePort {
  constructor(private readonly client: SupabaseClient) {}

  async append(event: ExperienceEvent): Promise<ExperienceAppendResult> {
    const { data: authData, error: authError } = await this.client.auth.getUser()
    if (authError || !authData.user) throw new Error("EXPERIENCE_UNAUTHENTICATED")

    const row: ExperienceRow = {
      event_id: event.id,
      user_id: authData.user.id,
      occurred_at: event.occurredAt,
      recorded_at: event.recordedAt,
      event_type: event.eventType,
      outcome: event.outcome ?? null,
      actor: event.actor,
      source: event.source,
      domain: event.domain ?? null,
      correlation_id: event.correlationId ?? null,
      causation_id: event.causationId ?? null,
      sensitivity: event.sensitivity,
      provenance: event.provenance,
      evidence: event.evidence,
      content: event.content,
      metadata: event.metadata ?? null,
    }

    const { error } = await this.client.from("jhadina_experience_events").insert(row)
    if (!error) return { accepted: true, duplicate: false, eventId: event.id }

    if (error.code !== "23505") {
      throw new Error(`EXPERIENCE_APPEND_FAILED:${error.message}`)
    }

    const { data: existing, error: readError } = await this.client
      .from("jhadina_experience_events")
      .select("event_id,user_id,occurred_at,recorded_at,event_type,outcome,actor,source,domain,correlation_id,causation_id,sensitivity,provenance,evidence,content,metadata")
      .eq("event_id", event.id)
      .maybeSingle<ExperienceRow>()

    if (readError || !existing) {
      throw new Error(`EXPERIENCE_CONFLICT_UNRESOLVED:${readError?.message ?? "event not found after unique conflict"}`)
    }

    if (!sameEvent(existing, row)) {
      throw new Error(`EXPERIENCE_EVENT_ID_CONFLICT:${event.id}`)
    }

    return { accepted: true, duplicate: true, eventId: event.id }
  }
}
