import { describe, expect, it } from 'vitest';
import { approvalReceiptToExperience } from './approval-experience-adapter.js';

const receipt = {
  id: 'receipt-1',
  actionId: 'action-1',
  userId: 'user-1',
  type: 'purchase',
  status: 'APPROVED',
  requestedAt: '2026-08-27T00:00:00.000Z',
  approvedAt: '2026-08-27T00:01:00.000Z',
  consumedAt: '2026-08-27T00:02:00.000Z',
  expiresAt: '2026-08-28T00:00:00.000Z',
  fingerprint: 'fp-1',
} as never;

describe('Approval Receipt → Experience adapter', () => {
  it.each([
    ['requested', 'action.approval_requested', 'requested'],
    ['approved', 'action.approval_approved', 'approved'],
    ['consumed', 'action.approval_consumed', 'completed'],
    ['expired', 'action.approval_expired', 'expired'],
  ] as const)('normalizes %s', (stage, eventType, outcome) => {
    const event = approvalReceiptToExperience(receipt, stage, { actor: 'user-1' });
    expect(event.eventType).toBe(eventType);
    expect(event.outcome).toBe(outcome);
    expect(event.correlationId).toBe('action-1');
    expect(event.provenance.sourceId).toBe('receipt-1');
    expect(event.sensitivity).toBe('restricted');
  });

  it('does not expose the receipt fingerprint in Experience metadata', () => {
    const event = approvalReceiptToExperience(receipt, 'approved');
    expect(event.metadata).not.toHaveProperty('fingerprint');
  });
});
