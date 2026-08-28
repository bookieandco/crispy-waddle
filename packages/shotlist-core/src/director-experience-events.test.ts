import { describe, expect, it } from 'vitest';
import { createDirectorTakeFeedbackEvent, createDirectorTakeGeneratedEvent } from './director-experience-events.js';

describe('director Experience events', () => {
  it('creates a typed generated-take event with owner and project scope', () => {
    const event = createDirectorTakeGeneratedEvent({ eventId: 'e1', ownerId: 'o1', projectId: 'p1', shotId: 's1', takeId: 't1', provider: 'test', clipUri: 'clip://1', occurredAt: '2026-08-27T00:00:00.000Z', controls: { framing: 'close-up' } });
    expect(event).toMatchObject({ eventType: 'director.take.generated', domain: 'directoros', scope: { type: 'user', ownerId: 'o1' }, metadata: { projectId: 'p1', shotId: 's1', takeId: 't1' } });
  });

  it('creates canonical feedback events with the reaction and project scope', () => {
    const event = createDirectorTakeFeedbackEvent({ eventId: 'e2', ownerId: 'o1', projectId: 'p1', shotId: 's1', takeId: 't1', reaction: 'love', occurredAt: '2026-08-27T00:00:00.000Z' });
    expect(event).toMatchObject({ eventType: 'director.take.feedback', metadata: { projectId: 'p1', reaction: 'love' } });
  });
});
