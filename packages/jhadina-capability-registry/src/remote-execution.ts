import type { CapabilityRegistry } from './index.js';
import type { RemoteCommandRequest, RemoteCommandResult, RemoteCommandPolicy } from './remote-command-gateway.js';
import type { RemoteResolver } from './remote-resolver.js';
import type { ResolvedRemoteCommand } from './remote-resolver.js';
import type { TransportRouter } from './remote-transport.js';

export interface RemoteCommandExecutor {
  execute(request: RemoteCommandRequest): Promise<RemoteCommandResult>;
}

export class ResolvedRemoteCommandExecutor implements RemoteCommandExecutor {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly policy: RemoteCommandPolicy,
    private readonly resolver: RemoteResolver,
    private readonly transports: TransportRouter,
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
    let resolved: ResolvedRemoteCommand;
    try {
      resolved = this.resolver.resolve(request);
      await this.transports.execute(resolved);
    } catch (error) {
      return {
        status: 'rejected',
        requestId: request.requestId,
        reason: error instanceof Error ? error.message : 'execution-failed',
      };
    }
    return { status: 'accepted', requestId: request.requestId };
  }
}
