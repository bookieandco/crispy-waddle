import { describe, expect, it } from 'vitest';
import { createExperienceEvent, type ExperienceScope } from './experience.js';

const scopeA: ExperienceScope = { type: 'user', ownerId: 'user-a' };
const scopeB: ExperienceScope = { type: 'user', ownerId: 'user-b' };
const base = { id: 'event-1', occurredAt: '2026-08-27T00:00:00.000Z', source: 'test', actor: 'user' as const, content: 'test', eventType: 'action.requested' as const };

describe('Experience scope', () => {
  it('requires a non-empty ownerId', () => {
    expect(() => createExperienceEvent({ ...base, scope: { type: 'user', ownerId: '   ' } })).toThrow('Experience scope ownerId is required');
  });

  it('keeps actor identity separate from ownership', () => {
    const event = createExperienceEvent({ ...base, actor: 'jhadina', scope: scopeA });
    expect(event.actor).toBe('jhadina');
    expect(event.scope).toEqual(scopeA);
  });

  it('preserves distinct owner scopes', () => {
    const a = createExperienceEvent({ ...base, id: 'a', scope: scopeA });
    const b = createExperienceEvent({ ...base, id: 'b', scope: scopeB });
    expect(a.scope.ownerId).toBe('user-a');
    expect(b.scope.ownerId).toBe('user-b');
    expect(a.scope.ownerId).not.toBe(b.scope.ownerId);
  });
});
