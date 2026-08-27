import type { ApprovalReceipt } from '@jhadina/action-core';
import { createExperienceEvent, normalizeActor, type ExperienceEvent } from './experience.js';

export type ApprovalReceiptEvent = 'requested' | 'approved' | 'consumed' | 'expired';

export function approvalReceiptToExperience(
  receipt: ApprovalReceipt,
  event: ApprovalReceiptEvent,
  input: { actor?: string; occurredAt?: string; correlationId?: string } = {},
): ExperienceEvent {
  const eventType = `action.approval_${event}` as ExperienceEvent['eventType'];
  const outcome = event === 'requested' ? 'requested' : event === 'approved' ? 'approved' : event === 'expired' ? 'expired' : 'completed';
  return createExperienceEvent({
    id: `approval:${receipt.id}:${event}`,
    occurredAt: input.occurredAt ?? receipt[`${event}At` as keyof ApprovalReceipt] as string ?? receipt.requestedAt,
    source: 'action-core',
    domain: 'action',
    actor: normalizeActor(input.actor),
    content: `Approval receipt ${event} for action ${receipt.actionId}.`,
    eventType,
    outcome,
    correlationId: input.correlationId ?? receipt.actionId,
    provenance: { sourceId: receipt.id, sourceType: 'approval-receipt' },
    sensitivity: 'restricted',
    metadata: { receiptStatus: receipt.status, actionType: receipt.type },
  });
}
