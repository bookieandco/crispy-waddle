import { describe, expect, it } from 'vitest';
import { createExperienceEvent, type ExperienceEvent } from './experience.js';
import type { ExperienceStore } from './experience-store.contract.js';

const scopeA = { type: 'user' as const, ownerId: 'user-a' };
const scopeB = { type: 'user' as const, ownerId: 'user-b' };

function event(id: string, scope = scopeA): ExperienceEvent {
  return createExperienceEvent({
    id,
    occurredAt: '2026-08-27T00:00:00.000Z',
    recordedAt: '2026-08-27T00:00:01.000Z',
    source: 'test',
    actor: 'jhadina',
    content: 'test event',
    eventType: 'action.completed',
    correlationId: 'corr-1',
    scope,
  });
}

class ContractStore implements ExperienceStore {
  private readonly rows = new Map<string, ExperienceEvent>();

  async append(value: ExperienceEvent) {
    const existing = this.rows.get(value.id);
    if (existing) {
      const conflict = JSON.stringify(existing) !== JSON.stringify(value);
      return { accepted: !conflict, duplicate: !conflict, conflict, eventId: value.id };
    }
    this.rows.set(value.id, structuredClone(value));
    return { accepted: true, duplicate: false, conflict: false, eventId: value.id };
  }

  async listByScope(scope: typeof scopeA) {
    return [...this.rows.values()].filter((row) => row.scope.type === scope.type && row.scope.ownerId === scope.ownerId);
  }
}

describe('ExperienceStore persistence contract', () => {
  it('is idempotent for the same event payload', async () => {
    const store = new ContractStore();
    const first = await store.append(event('e1'));
    const second = await store.append(event('e1'));
    expect(first).toEqual({ accepted: true, duplicate: false, conflict: false, eventId: 'e1' });
    expect(second).toEqual({ accepted: true, duplicate: true, conflict: false, eventId: 'e1' });
  });

  it('rejects a conflicting payload for an existing event id', async () => {
    const store = new ContractStore();
    await store.append(event('e1'));
    const conflicting = event('e1', scopeB);
    const result = await store.append(conflicting);
    expect(result).toEqual({ accepted: false, duplicate: false, conflict: true, eventId: 'e1' });
  });

  it('returns only events belonging to the requested owner', async () => {
    const store = new ContractStore();
    await store.append(event('a1', scopeA));
    await store.append(event('b1', scopeB));
    const rows = await store.listByScope(scopeA);
    expect(rows.map((row) => row.id)).toEqual(['a1']);
    expect(rows.every((row) => row.scope.ownerId === scopeA.ownerId)).toBe(true);
  });

  it('persists lineage and ownership fields without mutation', async () => {
    const store = new ContractStore();
    const original = event('e2');
    original.causationId = 'approval-1';
    await store.append(original);
    const [stored] = await store.listByScope(scopeA);
    expect(stored.correlationId).toBe('corr-1');
    expect(stored.causationId).toBe('approval-1');
    expect(stored.scope).toEqual(scopeA);
  });
});
