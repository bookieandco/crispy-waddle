import type { SafetySpatialSnapshot } from './safety-spatial-context.js';

export type SafetyTimelineEventKind =
  | 'spatial'
  | 'device-heartbeat'
  | 'vault-heartbeat'
  | 'check-in'
  | 'notification'
  | 'acknowledgment'
  | 'evidence'
  | 'connectivity'
  | 'protocol';

export interface SafetyTimelineEvent {
  readonly id: string;
  readonly incidentId: string;
  readonly kind: SafetyTimelineEventKind;
  readonly occurredAt: string;
  readonly sourceRef: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export function spatialSnapshotToTimeline(snapshot: SafetySpatialSnapshot): readonly SafetyTimelineEvent[] {
  return snapshot.signals.map((signal, index) => ({
    id: `${snapshot.incidentId}:spatial:${index}:${signal.observedAt}`,
    incidentId: snapshot.incidentId,
    kind: 'spatial',
    occurredAt: signal.observedAt,
    sourceRef: signal.evidenceId ?? signal.sourceId,
    payload: { evidenceClass: signal.evidenceClass, kind: signal.kind },
  }));
}

export function orderSafetyTimeline(events: readonly SafetyTimelineEvent[]): readonly SafetyTimelineEvent[] {
  return events.slice().sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
}
