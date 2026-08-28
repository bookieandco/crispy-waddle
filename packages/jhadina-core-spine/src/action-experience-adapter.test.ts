import { describe, expect, it } from 'vitest';
import {
  actionAuditEventToExperience,
  actionResultToExperience,
} from './action-experience-adapter.js';

describe('Action Core → Experience adapter', () => {
  it.each([
    ['started', 'action.started'],
    ['approval_required', 'action.approval_required'],
    ['completed', 'action.completed'],
    ['denied', 'action.denied'],
    ['failed', 'action.failed'],
  ] as const)('normalizes %s', (status, eventType) => {
    const event = actionAuditEventToExperience({
      id: `a-${status}`,
      actionId: 'action-1',
      userId: 'user-1',
      type: 'test.action',
      status,
      timestamp: '2026-08-27T00:00:00.000Z',
    });
    expect(event.eventType).toBe(eventType);
    expect(event.provenance.sourceId).toBe(`a-${status}`);
    expect(event.correlationId).toBe('action-1');
  });

  it('keeps a successful action successful when completion audit is incomplete', () => {
    const event = actionResultToExperience(
      { id: 'result-1', requestId: 'action-1', success: true, completedAt: '2026-08-27T00:00:00.000Z' },
      { userId: 'user-1', auditStatus: 'incomplete' },
    );
    expect(event.eventType).toBe('action.completed');
    expect(event.outcome).toBe('completed');
    expect(event.metadata?.auditStatus).toBe('incomplete');
    expect(event.metadata?.auditWarning).toBe(
      'external-action-completed-but-completion-audit-incomplete',
    );
  });

  it('normalizes a failed action as failed', () => {
    const event = actionResultToExperience(
      { id: 'result-2', requestId: 'action-2', success: false, completedAt: '2026-08-27T00:00:00.000Z' },
      { userId: 'user-1' },
    );
    expect(event.eventType).toBe('action.failed');
    expect(event.outcome).toBe('failed');
  });
});
