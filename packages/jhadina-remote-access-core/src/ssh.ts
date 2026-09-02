import type { RemoteAccessProvider, RemoteEndpoint, RemoteSession, RemoteSessionRequest } from './index.js';

export interface SshEndpoint extends RemoteEndpoint {
  readonly protocol: 'ssh';
  readonly port: number;
  readonly username: string;
}

export interface SshConnectionOptions {
  readonly connectTimeoutMs: number;
  readonly commandTimeoutMs: number;
  readonly hostKeyPolicy: 'strict' | 'known-hosts';
}

export interface SshTransport {
  connect(endpoint: SshEndpoint, options: SshConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  execute(command: string, timeoutMs: number): Promise<string>;
}

export class SshRemoteAccessProvider implements RemoteAccessProvider {
  readonly protocol = 'ssh' as const;

  constructor(
    private readonly transportFactory: (endpoint: SshEndpoint) => SshTransport,
    private readonly options: SshConnectionOptions,
  ) {}

  async connect(request: RemoteSessionRequest): Promise<RemoteSession> {
    const endpoint = validateSshEndpoint(request.endpoint);
    const transport = this.transportFactory(endpoint);
    await transport.connect(endpoint, this.options);
    return Object.freeze({
      id: `${endpoint.id}:ssh`,
      endpoint,
      protocol: 'ssh',
      connectedAt: new Date().toISOString(),
    });
  }

  async disconnect(session: RemoteSession): Promise<void> {
    validateSshSession(session);
    throw new Error('SSH transport binding is not available from the foundation contract');
  }

  async execute(_session: RemoteSession, _command: string): Promise<string> {
    throw new Error('SSH transport binding is not available from the foundation contract');
  }
}

export function validateSshEndpoint(endpoint: RemoteEndpoint): SshEndpoint {
  if (endpoint.protocol !== 'ssh') throw new Error('SSH provider requires an SSH endpoint');
  if (!endpoint.host.trim()) throw new Error('SSH endpoint host is required');
  if (!endpoint.port || endpoint.port < 1 || endpoint.port > 65535) {
    throw new Error('SSH endpoint port must be between 1 and 65535');
  }
  const username = (endpoint as Partial<SshEndpoint>).username;
  if (!username?.trim()) throw new Error('SSH endpoint username is required');
  return Object.freeze({ ...endpoint, username });
}

function validateSshSession(session: RemoteSession): void {
  if (session.protocol !== 'ssh') throw new Error('SSH provider requires an SSH session');
  validateSshEndpoint(session.endpoint);
}
