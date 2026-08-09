import type { AuditEntry, JhadinaEvent } from './contracts';
import type { EventBus } from './event-bus';
import type { TimelineGateway } from './core-adapters';

export class CoreAuditEventAdapter {
  constructor(
    private readonly timeline: TimelineGateway,
    private readonly events: EventBus,
  ) {}

  register(): () => void {
    const unsubscribeCompleted = this.events.subscribe('ACTION_COMPLETED', async (event: JhadinaEvent<{ requestId: string; capability: string }>) => {
      await this.timeline.recordReasoning({
        userId: 'system',
        reasoningEventId: event.payload.requestId,
        userMessage: event.payload.capability,
        systemResponse: 'Action completed through Jhadina Integration Spine.',
      });
    });

    const unsubscribeFailed = this.events.subscribe('ACTION_FAILED', async (event: JhadinaEvent<{ requestId: string; capability: string }>) => {
      await this.timeline.recordReasoning({
        userId: 'system',
        reasoningEventId: event.payload.requestId,
        userMessage: event.payload.capability,
        systemResponse: 'Action failed through Jhadina Integration Spine.',
      });
    });

    return () => {
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }
}

export function auditEntryToEvent(entry: AuditEntry): JhadinaEvent<AuditEntry> {
  return {
    id: entry.id,
    type: `AUDIT_${entry.outcome.toUpperCase()}`,
    source: entry.domain ?? 'core',
    occurredAt: entry.occurredAt,
    projectId: entry.projectId,
    payload: entry,
  };
}
