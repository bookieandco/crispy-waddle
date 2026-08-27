import type { ExperienceEvent } from './experience.js';
import { createExperienceEvent } from './experience.js';
import type { Experience } from './types.js';

export interface ActionLifecycleRecord {
  id: string;
  actionId: string;
  userId: string;
  type: string;
  status: 'started' | 'approval_required' | 'completed' | 'denied' | 'failed';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Converts Action Core's lifecycle record into the canonical Experience
 * representation without importing Action Core. This keeps Core Spine's
 * dependency direction clean while making the structural contract explicit.
 */
export function experienceFromActionLifecycle(
  event: ActionLifecycleRecord,
  options: {
    actor?: Experience['actor'];
    domain?: string;
    correlationId?: string;
  } = {},
): ExperienceEvent {
  const eventType = {
    started: 'action.started',
    approval_required: 'action.approval_required',
    completed: 'action.completed',
    denied: 'action.denied',
    failed: 'action.failed',
  }[event.status] as ExperienceEvent['eventType'];

  const outcome = {
    started: 'started',
    approval_required: 'proposed',
    completed: 'completed',
    denied: 'denied',
    failed: 'failed',
  }[event.status] as NonNullable<ExperienceEvent['outcome']>;

  return createExperienceEvent({
    id: `action-audit:${event.id}`,
    occurredAt: event.timestamp,
    source: 'action-core',
    domain: options.domain ?? 'action',
    actor: options.actor ?? 'jhadina',
    content: `Action ${event.actionId} ${event.status.replace('_', ' ')}.`,
    eventType,
    outcome,
    correlationId: options.correlationId ?? event.actionId,
    provenance: { sourceId: event.id, sourceType: 'action-audit-event' },
    sensitivity: 'sensitive',
    metadata: {
      actionType: event.type,
      userId: event.userId,
    },
  });
}
