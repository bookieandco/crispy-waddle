import { describe, expect, it, vi } from 'vitest';
import { SupabaseExperienceRecorder } from './supabase-experience-recorder.js';

const event = {
  id: 'event-1', occurredAt: '2026-08-27T00:00:00.000Z', recordedAt: '2026-08-27T00:00:01.000Z',
  eventType: 'action.completed', outcome: 'completed', actor: 'jhadina', source: 'action-core',
  domain: 'action', correlationId: 'action-1', causationId: undefined, sensitivity: 'sensitive',
  provenance: { sourceId: 'result-1', sourceType: 'action-result' }, evidence: [],
  content: 'Action action-1 completed.', metadata: { ok: true }, schemaVersion: 1,
} as never;

function client(insertResult: { error: any }, readResult?: { data: any; error: any }) {
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => readResult ?? { data: null, error: null }) })) })),
  }));
  return { from: vi.fn(() => ({ insert: vi.fn(async () => insertResult), select })) } as any;
}

describe('SupabaseExperienceRecorder', () => {
  it('records a new event', async () => {
    const recorder = new SupabaseExperienceRecorder(client({ error: null }), 'user-1');
    await expect(recorder.append(event)).resolves.toEqual({ accepted: true, duplicate: false, eventId: 'event-1' });
  });

  it('rejects a unique conflict when the existing event differs', async () => {
    const existing = {
      event_id: 'event-1', user_id: 'user-1', occurred_at: event.occurredAt, recorded_at: event.recordedAt,
      event_type: event.eventType, outcome: 'failed', actor: event.actor, source: event.source,
      domain: event.domain, correlation_id: event.correlationId, causation_id: null,
      sensitivity: event.sensitivity, provenance: event.provenance, evidence: [], content: event.content, metadata: event.metadata,
    };
    const recorder = new SupabaseExperienceRecorder(client({ error: { code: '23505', message: 'duplicate' } }, { data: existing, error: null }), 'user-1');
    await expect(recorder.append(event)).rejects.toThrow('Experience event ID collision');
  });

  it('recognizes an identical replay as a duplicate', async () => {
    const existing = {
      event_id: 'event-1', user_id: 'user-1', occurred_at: event.occurredAt, recorded_at: event.recordedAt,
      event_type: event.eventType, outcome: event.outcome, actor: event.actor, source: event.source,
      domain: event.domain, correlation_id: event.correlationId, causation_id: null,
      sensitivity: event.sensitivity, provenance: event.provenance, evidence: [], content: event.content, metadata: event.metadata,
    };
    const recorder = new SupabaseExperienceRecorder(client({ error: { code: '23505', message: 'duplicate' } }, { data: existing, error: null }), 'user-1');
    await expect(recorder.append(event)).resolves.toEqual({ accepted: true, duplicate: true, eventId: 'event-1' });
  });
});
