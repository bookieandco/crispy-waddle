import { describe, expect, it } from 'vitest';
import type { ExperienceEvent } from './experience.js';
import { toSupabaseExperienceRow, fromSupabaseExperienceRow } from './supabase-experience-storage.js';

const event: ExperienceEvent = {
  id: 'e1', occurredAt: '2026-08-27T00:00:00.000Z', recordedAt: '2026-08-27T00:00:01.000Z',
  source: 'test', domain: 'action', actor: 'jhadina', content: 'completed', evidence: [],
  schemaVersion: 1, eventType: 'action.completed', correlationId: 'corr-1', causationId: 'approval-1',
  outcome: 'completed', sensitivity: 'sensitive', provenance: { sourceId: 'r1', sourceType: 'action-result' },
  scope: { type: 'user', ownerId: 'owner-a' }, metadata: { auditStatus: 'complete' },
};

describe('Supabase Experience mapping', () => {
  it('maps scope.ownerId to user_id and preserves lineage', () => {
    const row = toSupabaseExperienceRow(event);
    expect(row.user_id).toBe('owner-a');
    expect(row.id).toBe('e1');
    expect(row.correlation_id).toBe('corr-1');
    expect(row.causation_id).toBe('approval-1');
  });

  it('maps a persisted row back into the canonical owner scope', () => {
    const restored = fromSupabaseExperienceRow(toSupabaseExperienceRow(event));
    expect(restored.scope).toEqual({ type: 'user', ownerId: 'owner-a' });
    expect(restored.correlationId).toBe('corr-1');
    expect(restored.causationId).toBe('approval-1');
  });

  it('does not permit a caller scope to rewrite the persisted owner', () => {
    const row = toSupabaseExperienceRow(event);
    expect(row.user_id).not.toBe('owner-b');
  });
});
