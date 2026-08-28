import { describe, expect, it } from 'vitest';
import { SupabaseExperienceStorage } from './supabase-experience-storage.js';
import type { ExperienceEvent } from './experience.js';

const scopeA = { type: 'user' as const, ownerId: 'owner-a' };
const scopeB = { type: 'user' as const, ownerId: 'owner-b' };

function makeEvent(id: string, scope = scopeA): ExperienceEvent {
  return {
    id,
    occurredAt: '2026-08-27T00:00:00.000Z',
    recordedAt: '2026-08-27T00:00:01.000Z',
    source: 'test',
    domain: 'action',
    actor: 'jhadina',
    content: 'completed',
    evidence: [],
    schemaVersion: 1,
    eventType: 'action.completed',
    correlationId: 'corr-1',
    causationId: 'approval-1',
    outcome: 'completed',
    sensitivity: 'sensitive',
    provenance: { sourceId: id, sourceType: 'test' },
    scope,
  };
}

type Row = Record<string, unknown>;

class Query {
  private filters: Record<string, unknown> = {};
  private mode: 'insert' | 'select' = 'select';
  private inserted: Row | undefined;
  constructor(private readonly db: Row[]) {}
  insert(row: Row) { this.mode = 'insert'; this.inserted = row; return this; }
  select() { return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  order() { return this; }
  async maybeSingle() {
    const matches = this.db.filter((row) => Object.entries(this.filters).every(([key, value]) => row[key] === value));
    if (this.mode === 'insert') {
      const row = this.inserted!;
      if (this.db.some((existing) => existing.id === row.id)) return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
      this.db.push(structuredClone(row));
      return { data: structuredClone(row), error: null };
    }
    return { data: matches[0] ? structuredClone(matches[0]) : null, error: null };
  }
  async then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return resolve({ data: this.db.filter((row) => Object.entries(this.filters).every(([key, value]) => row[key] === value)), error: null });
  }
}

function fakeClient(rows: Row[]) {
  return { from: () => new Query(rows) } as any;
}

describe('SupabaseExperienceStorage persistence', () => {
  it('performs insert, duplicate replay, and conflicting replay', async () => {
    const rows: Row[] = [];
    const store = new SupabaseExperienceStorage(fakeClient(rows));
    const original = makeEvent('e1');

    expect(await store.append(original)).toEqual({ accepted: true, duplicate: false, conflict: false, eventId: 'e1' });
    expect(await store.append(structuredClone(original))).toEqual({ accepted: true, duplicate: true, conflict: false, eventId: 'e1' });
    expect(await store.append(makeEvent('e1', scopeB))).toEqual({ accepted: false, duplicate: false, conflict: true, eventId: 'e1' });
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('owner-a');
  });

  it('maps listByScope to user_id filtering and never returns another owner', async () => {
    const rows: Row[] = [];
    const store = new SupabaseExperienceStorage(fakeClient(rows));
    await store.append(makeEvent('a1', scopeA));
    await store.append(makeEvent('b1', scopeB));

    const ownerA = await store.listByScope(scopeA);
    const ownerB = await store.listByScope(scopeB);
    expect(ownerA.map((event) => event.id)).toEqual(['a1']);
    expect(ownerB.map((event) => event.id)).toEqual(['b1']);
  });
});
