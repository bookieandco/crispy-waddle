export type RemoteTransportState = 'idle' | 'connecting' | 'connected' | 'closing' | 'closed' | 'failed';

export type RemoteTransportRequest = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  sessionId?: string;
}>;

export interface RemoteTransportSession {
  readonly sessionId: string;
  readonly state: RemoteTransportState;
  execute(command: string, request?: RemoteTransportRequest): Promise<string>;
  close(): Promise<void>;
}

export interface RemoteTransport<TConnection = unknown> {
  connect(connection: TConnection, request?: RemoteTransportRequest): Promise<RemoteTransportSession>;
}

export function assertTransportCommand(command: string): void {
  if (!command.trim()) throw new Error('Remote command must not be empty');
}
