import { describe, expect, it } from 'vitest';
import { experienceFromActionResult, experienceFromAuditEvent, experienceFromMemoryProposal } from './experience.js';

const result = { id: 'result-1', completedAt: '2026-08-27T00:00:00.000Z', success: true } as any;
const proposal = { id: 'proposal-1', disposition: 'SAVE', evidence: [] } as any;
const audit = { id: 'audit-1', occurredAt: '2026-08-27T00:00:00.000Z', type: 'DECISION_AUTHORIZED', subjectId: 'action-1', actor: 'USER' } as any;

describe('Experience lineage', () => {
  it('preserves action correlation and causation without inventing causation', () => {
    const event = experienceFromActionResult(result, { actionId: 'action-1', correlationId: 'op-1', causationId: 'approval-1' });
    expect(event.correlationId).toBe('op-1');
    expect(event.causationId).toBe('approval-1');
    expect(experienceFromActionResult(result, { actionId: 'action-1', correlationId: 'op-1' }).causationId).toBeUndefined();
  });

  it('preserves memory correlation and causation', () => {
    const event = experienceFromMemoryProposal(proposal, 'memory-core', 'USER', { correlationId: 'op-1', causationId: 'request-1' });
    expect(event.correlationId).toBe('op-1');
    expect(event.causationId).toBe('request-1');
    expect(event.actor).toBe('user');
  });

  it('preserves audit lineage and normalizes its actor', () => {
    const event = experienceFromAuditEvent(audit, { correlationId: 'op-1', causationId: 'decision-1' });
    expect(event.correlationId).toBe('op-1');
    expect(event.causationId).toBe('decision-1');
    expect(event.actor).toBe('user');
  });
});
