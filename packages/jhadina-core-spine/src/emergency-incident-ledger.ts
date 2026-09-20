export type EmergencyIncidentEventType =
  | 'triggered'
  | 'protocol-selected'
  | 'capture-started'
  | 'evidence-persisted'
  | 'notification-attempted'
  | 'notification-acknowledged'
  | 'escalated'
  | 'release-authorized'
  | 'release-executed'
  | 'contingency-applied'
  | 'resolved';

export interface EmergencyIncidentEvent {
  readonly id: string;
  readonly incidentId: string;
  readonly type: EmergencyIncidentEventType;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EmergencyIncidentLedger {
  append(event: EmergencyIncidentEvent): Promise<'recorded' | 'duplicate'>;
  list(incidentId: string): Promise<readonly EmergencyIncidentEvent[]>;
}

export function assertMonotonicEmergencyEvents(events: readonly EmergencyIncidentEvent[]): void {
  for (let index = 1; index < events.length; index += 1) {
    if (Date.parse(events[index].occurredAt) < Date.parse(events[index - 1].occurredAt)) {
      throw new Error('Emergency incident events are not monotonic');
    }
  }
}
