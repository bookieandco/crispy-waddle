import { describe, expect, it } from 'vitest';
import {
  InMemoryExperienceRecorder,
  createExperienceEvent,
  experienceFromActionResult,
  experienceFromAuditEvent,
} from './experience.js';

describe('Experience contract', () => {
  it('accepts the same event id idempotently', async () => {
    const recorder = new InMemoryExperienceRecorder();
    const event = createExperienceEvent({
      id: 'e-1', occurredAt: '2026-08-27T00:00:00.000Z', source: 'test',
      actor: 'system', content: 'hello', eventType: 'decision.authorized',
    });
    expect(await recorder.append(event)).toEqual({ accepted: true, duplicate: false, eventId: 'e-1' });
    expect(await recorder.append(event)).toEqual({ accepted: true, duplicate: true, eventId: 'e-1' });
  });

  it('preserves the originating audit actor', () => {
    const event = experienceFromAuditEvent({
      id: 'a-1', occurredAt: '2026-08-27T00:00:00.000Z', type: 'DECISION_AUTHORIZED',
      subjectId: 's-1', actor: 'user',
    });
    expect(event.actor).toBe('user');
    expect(event.provenance.sourceId).toBe('a-1');
  });

  it('normalizes successful and failed action results', () => {
    const result = experienceFromActionResult({
      id: 'r-1', completedAt: '2026-08-27T00:00:00.000Z', success: true,
    } as never, { actionId: 'a-1' });
    expect(result.eventType).toBe('action.completed');
    expect(result.outcome).toBe('completed');
  });

  it('redacts credential-shaped content', () => {
    const event = createExperienceEvent({
      id: 'e-2', occurredAt: '2026-08-27T00:00:00.000Z', source: 'test',
      actor: 'system', content: 'api_key=supersecret', eventType: 'experience.corrected',
    });
    expect(event.content).toContain('[REDACTED]');
    expect(event.content).not.toContain('supersecret');
  });
});
