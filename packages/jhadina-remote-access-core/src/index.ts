export type RemoteProtocol =
  | 'rdp' | 'ssh' | 'vnc' | 'telnet' | 'http' | 'https' | 'rlogin'
  | 'raw-socket' | 'powershell-remoting' | 'anydesk';

export type RemoteAccessOperation = 'connect' | 'disconnect' | 'execute' | 'observe';

export interface RemoteEndpoint {
  readonly id: string;
  readonly protocol: RemoteProtocol;
  readonly host: string;
  readonly port?: number;
}

export interface RemoteSessionRequest {
  readonly capability: string;
  readonly operation: RemoteAccessOperation;
  readonly endpoint: RemoteEndpoint;
  readonly requestedBy: string;
  readonly reason?: string;
}

export interface RemoteAccessGrant {
  readonly capability: string;
  readonly protocols: readonly RemoteProtocol[];
  readonly operations: readonly RemoteAccessOperation[];
  readonly endpointIds?: readonly string[];
  readonly expiresAt?: string;
}

export interface RemoteAccessPolicy {
  authorize(request: RemoteSessionRequest, grant: RemoteAccessGrant): void;
}

export interface RemoteSession {
  readonly id: string;
  readonly endpoint: RemoteEndpoint;
  readonly protocol: RemoteProtocol;
  readonly connectedAt: string;
}

export interface RemoteAccessProvider {
  readonly protocol: RemoteProtocol;
  connect(request: RemoteSessionRequest): Promise<RemoteSession>;
  disconnect(session: RemoteSession): Promise<void>;
  execute?(session: RemoteSession, command: string): Promise<string>;
  observe?(session: RemoteSession): Promise<unknown>;
}

export interface RemoteAccessRuntime {
  open(request: RemoteSessionRequest, grant: RemoteAccessGrant): Promise<RemoteSession>;
  close(request: RemoteSessionRequest, grant: RemoteAccessGrant, session: RemoteSession): Promise<void>;
  execute(request: RemoteSessionRequest, grant: RemoteAccessGrant, session: RemoteSession, command: string): Promise<string>;
}

export class DefaultRemoteAccessPolicy implements RemoteAccessPolicy {
  authorize(request: RemoteSessionRequest, grant: RemoteAccessGrant): void {
    if (request.capability !== grant.capability) throw new Error('Remote access capability denied');
    if (!grant.protocols.includes(request.endpoint.protocol)) throw new Error(`Remote protocol denied: ${request.endpoint.protocol}`);
    if (!grant.operations.includes(request.operation)) throw new Error(`Remote operation denied: ${request.operation}`);
    if (grant.endpointIds && !grant.endpointIds.includes(request.endpoint.id)) throw new Error(`Remote endpoint denied: ${request.endpoint.id}`);
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) throw new Error('Remote access grant expired');
  }
}

export { RemoteAccessProviderRegistry } from './provider-registry.js';
export { REMOTE_ACCESS_CAPABILITY, remoteAccessCapability, registerRemoteAccessCapability } from './capability.js';

import { RemoteAccessProviderRegistry } from './provider-registry.js';

export class InMemoryRemoteAccessRuntime implements RemoteAccessRuntime {
  private readonly providers: RemoteAccessProviderRegistry;
  private readonly sessions = new Map<string, RemoteAccessProvider>();
  private readonly policy: RemoteAccessPolicy;

  constructor(policy: RemoteAccessPolicy = new DefaultRemoteAccessPolicy(), providers = new RemoteAccessProviderRegistry()) {
    this.policy = policy;
    this.providers = providers;
  }

  registerProvider(provider: RemoteAccessProvider): void {
    this.providers.register(provider);
  }

  async open(request: RemoteSessionRequest, grant: RemoteAccessGrant): Promise<RemoteSession> {
    this.policy.authorize(request, grant);
    if (request.operation !== 'connect') throw new Error('Opening a remote session requires the connect operation');
    const provider = this.providers.resolve(request.endpoint.protocol);
    const session = await provider.connect(request);
    this.sessions.set(session.id, provider);
    return Object.freeze({ ...session });
  }

  async close(request: RemoteSessionRequest, grant: RemoteAccessGrant, session: RemoteSession): Promise<void> {
    this.policy.authorize(request, grant);
    if (request.operation !== 'disconnect') throw new Error('Closing a remote session requires the disconnect operation');
    const provider = this.sessions.get(session.id);
    if (!provider) throw new Error(`Remote session not found: ${session.id}`);
    if (request.endpoint.id !== session.endpoint.id) throw new Error('Remote session endpoint mismatch');
    await provider.disconnect(session);
    this.sessions.delete(session.id);
  }

  async execute(request: RemoteSessionRequest, grant: RemoteAccessGrant, session: RemoteSession, command: string): Promise<string> {
    this.policy.authorize(request, grant);
    if (request.operation !== 'execute') throw new Error('Remote execution requires the execute operation');
    const provider = this.sessions.get(session.id);
    if (!provider) throw new Error(`Remote session not found: ${session.id}`);
    if (request.endpoint.id !== session.endpoint.id) throw new Error('Remote session endpoint mismatch');
    if (!provider.execute) throw new Error(`Remote execution unsupported: ${session.protocol}`);
    return provider.execute(session, command);
  }
}
