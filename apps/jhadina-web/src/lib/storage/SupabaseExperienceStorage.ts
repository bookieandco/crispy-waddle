import type { SupabaseClient } from "@supabase/supabase-js"
import type { ExperienceEvent, ExperienceScope } from "../../../../packages/jhadina-core-spine/src/experience.js"
import type { ExperienceStore } from "../../../../packages/jhadina-core-spine/src/experience-store.contract.js"

type ExperienceRow = {
  id: string
  user_id: string
  occurred_at: string
  recorded_at: string
  source: string
  domain: string | null
  actor: ExperienceEvent["actor"]
  content: string
  evidence: unknown
  schema_version: number
  event_type: string
  correlation_id: string | null
  causation_id: string | null
  outcome: ExperienceEvent["outcome"] | null
  sensitivity: ExperienceEvent["sensitivity"]
  provenance: unknown
  metadata: unknown
}

function toRow(event: ExperienceEvent): ExperienceRow {
  return {
    id: event.id,
    user_id: event.scope.ownerId,
    occurred_at: event.occurredAt,
    recorded_at: event.recordedAt,
    source: event.source,
    domain: event.domain ?? null,
    actor: event.actor,
    content: event.content,
    evidence: event.evidence,
    schema_version: event.schemaVersion,
    event_type: event.eventType,
    correlation_id: event.correlationId ?? null,
    causation_id: event.causationId ?? null,
    outcome: event.outcome ?? null,
    sensitivity: event.sensitivity,
    provenance: event.provenance,
    metadata: event.metadata ?? null,
  }
}

export function toSupabaseExperienceRow(event: ExperienceEvent): ExperienceRow {
  return toRow(event)
}

export function fromSupabaseExperienceRow(row: ExperienceRow): ExperienceEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    source: row.source,
    domain: row.domain ?? undefined,
    actor: row.actor,
    content: row.content,
    evidence: Array.isArray(row.evidence) ? row.evidence as ExperienceEvent["evidence"] : [],
    schemaVersion: 1,
    eventType: row.event_type as ExperienceEvent["eventType"],
    correlationId: row.correlation_id ?? undefined,
    causationId: row.causation_id ?? undefined,
    outcome: row.outcome ?? undefined,
    sensitivity: row.sensitivity,
    provenance: row.provenance as ExperienceEvent["provenance"],
    scope: { type: "user", ownerId: row.user_id },
    metadata: row.metadata as ExperienceEvent["metadata"],
  }
}

function isDuplicateConflict(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505"
}

function assertError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`JHADINA_EXPERIENCE_STORAGE_FAILED:${context}:${error.message}`)
}

export class SupabaseExperienceStorage implements ExperienceStore {
  constructor(private readonly client: SupabaseClient) {}

  async append(event: ExperienceEvent) {
    const row = toRow(event)
    const { error } = await this.client.from("jhadina_experience_events").insert(row)
    if (!error) return { accepted: true, duplicate: false, conflict: false, eventId: event.id }
    if (!isDuplicateConflict(error)) assertError(error, "append")

    const { data, error: lookupError } = await this.client
      .from("jhadina_experience_events")
      .select("*")
      .eq("id", event.id)
      .eq("user_id", event.scope.ownerId)
      .maybeSingle()
    assertError(lookupError, "append.lookup")
    if (!data) return { accepted: false, duplicate: false, conflict: true, eventId: event.id }

    const existing = fromSupabaseExperienceRow(data as ExperienceRow)
    const same = JSON.stringify(existing) === JSON.stringify(event)
    return { accepted: same, duplicate: same, conflict: !same, eventId: event.id }
  }

  async listByScope(scope: ExperienceScope): Promise<ExperienceEvent[]> {
    const { data, error } = await this.client
      .from("jhadina_experience_events")
      .select("*")
      .eq("user_id", scope.ownerId)
      .order("recorded_at", { ascending: false })
      .order("id", { ascending: true })
    assertError(error, "listByScope")
    return (data ?? []).map((row) => fromSupabaseExperienceRow(row as ExperienceRow))
  }
}
