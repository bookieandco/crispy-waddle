import type { ExperienceEvent, ExperienceScope } from './experience.js';
import type { ExperienceStore } from './experience-store.contract.js';

type ExperienceRow = {
  id: string; user_id: string; occurred_at: string; recorded_at: string; source: string; domain: string | null;
  actor: ExperienceEvent['actor']; content: string; evidence: unknown[]; schema_version: number; event_type: string;
  correlation_id: string | null; causation_id: string | null; outcome: string | null; sensitivity: ExperienceEvent['sensitivity'];
  provenance: Record<string, unknown>; metadata: Record<string, unknown> | null;
};

type QueryResult<T> = Promise<{ data: T | null; error: { message: string; code?: string } | null }>;
type ExperienceQuery = {
  select(columns: string): ExperienceQuery;
  eq(column: string, value: string): ExperienceQuery;
  order(column: string, options: { ascending: boolean }): ExperienceQuery;
  maybeSingle(): QueryResult<ExperienceRow>;
};

export interface ExperienceSupabaseClient {
  from(table: 'jhadina_experience_events'): {
    insert(row: ExperienceRow): ExperienceQuery;
    select(columns: string): ExperienceQuery;
  };
  rpc(name: 'list_jhadina_experience_events', args: { p_user_id: string }): QueryResult<ExperienceRow[]>;
}

const UNIQUE_VIOLATION = '23505';

function toRow(event: ExperienceEvent): ExperienceRow {
  return {
    id: event.id, user_id: event.scope.ownerId, occurred_at: event.occurredAt, recorded_at: event.recordedAt,
    source: event.source, domain: event.domain ?? null, actor: event.actor, content: event.content, evidence: event.evidence,
    schema_version: event.schemaVersion, event_type: event.eventType, correlation_id: event.correlationId ?? null,
    causation_id: event.causationId ?? null, outcome: event.outcome ?? null, sensitivity: event.sensitivity,
    provenance: event.provenance, metadata: event.metadata ?? null,
  };
}

function fromRow(row: ExperienceRow): ExperienceEvent {
  return {
    id: row.id, occurredAt: row.occurred_at, recordedAt: row.recorded_at, source: row.source, domain: row.domain ?? undefined,
    actor: row.actor, content: row.content, evidence: row.evidence as ExperienceEvent['evidence'], schemaVersion: row.schema_version as 1,
    eventType: row.event_type, correlationId: row.correlation_id ?? undefined, causationId: row.causation_id ?? undefined,
    outcome: (row.outcome as ExperienceEvent['outcome']) ?? undefined, sensitivity: row.sensitivity,
    provenance: row.provenance as ExperienceEvent['provenance'], scope: { type: 'user', ownerId: row.user_id }, metadata: row.metadata ?? undefined,
  };
}

function samePayload(a: ExperienceEvent, b: ExperienceEvent): boolean {
  return JSON.stringify(toRow(a)) === JSON.stringify(toRow(b));
}

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`JHADINA_EXPERIENCE_STORAGE_FAILED:${context}:${error.message}`);
}

export class SupabaseExperienceStorage implements ExperienceStore {
  constructor(private readonly client: ExperienceSupabaseClient) {}

  async append(event: ExperienceEvent) {
    const row = toRow(event);
    const { error } = await this.client.from('jhadina_experience_events').insert(row).select('*').maybeSingle();
    if (!error) return { accepted: true, duplicate: false, conflict: false, eventId: event.id };
    if (error.code !== UNIQUE_VIOLATION) assertNoError(error, 'append.insert');

    const { data: existing, error: lookupError } = await this.client
      .from('jhadina_experience_events').select('*').eq('id', event.id).maybeSingle();
    assertNoError(lookupError, 'append.lookup');
    if (!existing) assertNoError(error, 'append.insert');

    const persisted = fromRow(existing as ExperienceRow);
    if (samePayload(persisted, event)) return { accepted: true, duplicate: true, conflict: false, eventId: event.id };
    return { accepted: false, duplicate: false, conflict: true, eventId: event.id };
  }

  async listByScope(scope: ExperienceScope): Promise<ExperienceEvent[]> {
    if (!scope.ownerId.trim()) throw new Error('Experience scope ownerId is required');
    const { data, error } = await this.client.rpc('list_jhadina_experience_events', { p_user_id: scope.ownerId });
    assertNoError(error, 'listByScope');
    return ((data ?? []) as ExperienceRow[]).map(fromRow);
  }
}

export { toRow as toSupabaseExperienceRow, fromRow as fromSupabaseExperienceRow };
