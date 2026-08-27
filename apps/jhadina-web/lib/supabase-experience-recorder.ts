import type { ExperienceEvent, ExperiencePort, ExperienceAppendResult } from '@jhadina/core-spine';
import type { SupabaseClient } from '@supabase/supabase-js';

type ExperienceRow = {
  event_id: string;
  user_id: string;
  occurred_at: string;
  recorded_at: string;
  event_type: string;
  outcome: string | null;
  actor: string;
  source: string;
  domain: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  sensitivity: ExperienceEvent['sensitivity'];
  provenance: ExperienceEvent['provenance'];
  evidence: ExperienceEvent['evidence'];
  content: string;
  metadata: ExperienceEvent['metadata'] | null;
};

export class SupabaseExperienceRecorder implements ExperiencePort {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async append(event: ExperienceEvent): Promise<ExperienceAppendResult> {
    if (!this.userId) throw new Error('Experience recorder requires an authenticated user');

    const row: ExperienceRow = {
      event_id: event.id,
      user_id: this.userId,
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
    };

    const { error } = await this.client.from('jhadina_experience_events').insert(row);
    if (!error) return { accepted: true, duplicate: false, eventId: event.id };

    if (error.code !== '23505') throw new Error(`Experience append failed: ${error.message}`);

    // event_id is globally unique. RLS intentionally prevents probing another
    // user's row, so a missing user-scoped read is treated as an unverified
    // collision rather than a duplicate.
    const { data, error: readError } = await this.client
      .from('jhadina_experience_events')
      .select('event_id, user_id, occurred_at, recorded_at, event_type, outcome, actor, source, domain, correlation_id, causation_id, sensitivity, provenance, evidence, content, metadata')
      .eq('event_id', event.id)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (readError) throw new Error(`Experience duplicate check failed: ${readError.message}`);
    if (!data) throw new Error(`Experience event ID collision could not be verified: ${event.id}`);

    const existing = data as ExperienceRow;
    const equivalent = JSON.stringify(existing) === JSON.stringify(row);
    if (!equivalent) throw new Error(`Experience event ID collision: ${event.id}`);

    return { accepted: true, duplicate: true, eventId: event.id };
  }
}
