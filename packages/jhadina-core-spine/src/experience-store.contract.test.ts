import { describe, expect, it } from 'vitest';
import { assertExperienceScopeMatch, type ExperienceStore } from './experience-store.contract.js';
import type { ExperienceEvent, ExperienceScope } from './experience.js';

const a: ExperienceScope = { type: 'user', ownerId: 'user-a' };
const b: ExperienceScope = { type: 'user', ownerId: 'user-b' };
const event = { scope: a } as ExperienceEvent;

describe('ExperienceStore scope boundary', () => {
  it('accepts an event only for the requested owner scope', () => {
    expect(() => assertExperienceScopeMatch(event, a)).not.toThrow();
    expect(() => assertExperienceScopeMatch(event, b)).toThrow('Experience scope mismatch');
  });

  it('requires stores to expose scope-filtered reads', () => {
    const store: ExperienceStore = { append: async () => ({ accepted: true, duplicate: false, conflict: false, eventId: 'e1' }), listByScope: async () => [event] };
    expect(store.listByScope).toBeDefined();
  });
});
