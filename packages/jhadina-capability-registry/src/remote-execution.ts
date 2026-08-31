import type { CapabilityRegistry } from './index.js';
import type { RemoteCommandRequest, RemoteCommandResult, RemoteCommandPolicy } from './remote-command-gateway.js';
import type { RemoteResolver } from './remote-resolver.js';
import type { RemoteTransportRouter } from './remote-transport.js';

export class ResolvedRemoteCommandExecutor {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly policy: RemoteCommandPolicy,
    private readonly resolver: RemoteResolver,
    private readonly transports: RemoteTransportRouter,
  ) {}

  async execute(request: RemoteCommandRequest): Promise<RemoteCommandResult> {
    if (!request.requestId.trim() || !request.deviceId.trim() || !request.capability.trim()) {
      return { status: 'rejected', requestId: request.requestId, reason: 'invalid-request' };
    }
    const capability = this.registry.get(request.capability);
    if (!capability) return { status: 'rejected', requestId: request.requestId, reason: 'unknown-capability' };
    if (!(await this.policy.authorize(request, capability))) {
      return { status: 'rejected', requestId: request.requestId, reason: 'policy-denied' };
    }
    const resolved = this.resolver.resolve(request);
    const transport = this.transports.resolve(resolved);
    if (!transport) return { status: 'rejected', requestId: request.requestId, reason: 'no-supported-transport' };
    await transport.execute(resolved);
    return { status: 'accepted', requestId: request.requestId };
  }
}
