import { describe, expect, it, vi } from "vitest"
import { SupabaseExperienceRecorder } from "./supabase-experience-recorder"

const event = {
  id: "experience-1",
  occurredAt: "2026-08-27T00:00:00.000Z",
  recordedAt: "2026-08-27T00:01:00.000Z",
  source: "test",
  domain: "test",
  actor: "user",
  content: "sanitized event",
  evidence: [],
  eventType: "action.completed",
  outcome: "completed",
  sensitivity: "private",
  provenance: { sourceType: "test" },
} as never

function clientForInsert(result: { error: unknown }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue(result) }),
  } as never
}

describe("SupabaseExperienceRecorder", () => {
  it("requires an authenticated Supabase user", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as never
    await expect(new SupabaseExperienceRecorder(client).append(event)).rejects.toThrow("EXPERIENCE_UNAUTHENTICATED")
  })

  it("returns accepted=false only through errors and reports a successful insert as non-duplicate", async () => {
    const client = clientForInsert({ error: null })
    await expect(new SupabaseExperienceRecorder(client).append(event)).resolves.toEqual({
      accepted: true, duplicate: false, eventId: "experience-1",
    })
  })

  it("treats an identical unique-key conflict as an idempotent duplicate", async () => {
    const existing = {
      event_id: event.id,
      user_id: "user-1",
      occurred_at: event.occurredAt,
      recorded_at: event.recordedAt,
      event_type: event.eventType,
      outcome: event.outcome,
      actor: event.actor,
      source: event.source,
      domain: event.domain,
      correlation_id: null,
      causation_id: null,
      sensitivity: event.sensitivity,
      provenance: event.provenance,
      evidence: [],
      content: event.content,
      metadata: null,
    }
    const query = {
      insert: vi.fn().mockResolvedValue({ error: { code: "23505", message: "duplicate key" } }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }) }),
      }),
    }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(query),
    } as never
    await expect(new SupabaseExperienceRecorder(client).append(event)).resolves.toEqual({
      accepted: true, duplicate: true, eventId: event.id,
    })
  })
})
