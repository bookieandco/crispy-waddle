import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ActionResult, AuditEvent, MemoryProposal } from './types.js';
import {
  InMemoryExperienceRecorder,
  createExperienceEvent,
  experienceFromActionResult,
  experienceFromAuditEvent,
  experienceFromMemoryProposal,
} from './experience.js';

describe('Experience contract', () => {
  it('creates versioned events and redacts credential-shaped content', () => {
    const event = createExperienceEvent({
      id: 'evt-1',
      occurredAt: '2026-08-27T00:00:00.000Z',
      source: 'test',
      actor: 'user',
      content: 'authorization: Bearer abc123 api_key=secret123 secret=mysecret password=hunter2',
      eventType: 'experience.corrected',
    });

    assert.equal(event.schemaVersion, 1);
    assert.equal(event.sensitivity, 'private');
    assert.match(event.content, /authorization: Bearer \[REDACTED\]/);
    assert.match(event.content, /api_key=\[REDACTED\]/);
    assert.match(event.content, /secret=\[REDACTED\]/);
    assert.match(event.content, /password=\[REDACTED\]/);
    assert.ok(!event.content.includes('abc123'));
    assert.ok(!event.content.includes('secret123'));
    assert.ok(!event.content.includes('mysecret'));
    assert.ok(!event.content.includes('hunter2'));
  });

  it('preserves the original audit actor when normalizing an audit event', () => {
    const audit: AuditEvent = {
      id: 'audit-1',
      type: 'DECISION_AUTHORIZED',
      occurredAt: '2026-08-27T00:00:00.000Z',
      actor: 'user',
      subjectId: 'action-1',
      payload: {},
    };

    const event = experienceFromAuditEvent(audit);
    assert.equal(event.actor, 'user');
    assert.equal(event.eventType, 'decision.authorized');
    assert.equal(event.provenance.sourceId, 'audit-1');
  });

  it('normalizes successful actions without turning them into failed experiences', () => {
    const result: ActionResult = {
      id: 'result-1',
      requestId: 'request-1',
      success: true,
      completedAt: '2026-08-27T00:00:01.000Z',
    };

    const event = experienceFromActionResult(result, {
      actionId: 'action-1',
      auditStatus: 'incomplete',
    });

    assert.equal(event.eventType, 'action.completed');
    assert.equal(event.outcome, 'completed');
    assert.equal(event.metadata?.auditStatus, 'incomplete');
    assert.equal(event.metadata?.auditWarning, 'external-action-completed-but-completion-audit-incomplete');
  });

  it('preserves the originating actor for memory lifecycle events', () => {
    const proposal: MemoryProposal = {
      id: 'memory-1',
      content: 'User prefers concise answers.',
      reason: 'explicit preference',
      evidence: [],
      disposition: 'SAVE',
    };

    const event = experienceFromMemoryProposal(proposal, 'memory-core', 'user');
    assert.equal(event.actor, 'user');
    assert.equal(event.eventType, 'memory.approved');
    assert.equal(event.outcome, 'approved');
  });

  it('treats an identical repeated event id as an idempotent duplicate', async () => {
    const recorder = new InMemoryExperienceRecorder();
    const event = createExperienceEvent({
      id: 'evt-duplicate',
      occurredAt: '2026-08-27T00:00:00.000Z',
      source: 'test',
      actor: 'system',
      content: 'same event',
      eventType: 'action.started',
    });

    const first = await recorder.append(event);
    const second = await recorder.append(structuredClone(event));

    assert.deepEqual(first, { accepted: true, duplicate: false, conflict: false, eventId: 'evt-duplicate' });
    assert.deepEqual(second, { accepted: true, duplicate: true, conflict: false, eventId: 'evt-duplicate' });
    assert.equal(recorder.snapshot().length, 1);
  });

  it('rejects reuse of an event id for different content', async () => {
    const recorder = new InMemoryExperienceRecorder();
    const first = createExperienceEvent({
      id: 'evt-conflict',
      occurredAt: '2026-08-27T00:00:00.000Z',
      source: 'test',
      actor: 'system',
      content: 'first',
      eventType: 'action.started',
    });
    const second = createExperienceEvent({
      id: 'evt-conflict',
      occurredAt: '2026-08-27T00:00:00.000Z',
      source: 'test',
      actor: 'system',
      content: 'different',
      eventType: 'action.started',
    });

    await recorder.append(first);
    const result = await recorder.append(second);

    assert.deepEqual(result, { accepted: false, duplicate: false, conflict: true, eventId: 'evt-conflict' });
    assert.equal(recorder.snapshot()[0]?.content, 'first');
  });
});
