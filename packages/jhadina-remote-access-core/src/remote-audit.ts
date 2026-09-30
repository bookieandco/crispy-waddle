export type RemoteAuditEventType =
  | 'session.connect.requested'
  | 'session.connect.denied'
  | 'session.connected'
  | 'command.requested'
  | 'command.denied'
  | 'command.completed'
  | 'session.closed';

export type RemoteAuditEvent = Readonly<{
  id: string;
  type: RemoteAuditEventType;
  sessionId: string;
  protocol: string;
  host: string;
  port: number;
  timestamp: string;
  reason?: string;
  commandHash?: string;
}>;

export interface RemoteAuditSink {
  record(event: RemoteAuditEvent): Promise<void> | void;
}

export function createRemoteAuditEvent(
  input: Omit<RemoteAuditEvent, 'id' | 'timestamp'>,
): RemoteAuditEvent {
  return Object.freeze({
    ...input,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}
