import type { CapabilityRegistry } from './index.js';

export type RemoteCommandResult =
  | { status: 'accepted'; requestId: string }
  | { status: 'rejected'; requestId: string; reason: string };

export interface RemoteCommandRequest {
  readonly requestId: string;
  readonly capability: string;
  readonly deviceId: string;
  readonly payload?: unknown;
}

export interface RemoteCommandPolicy {
  authorize(request: RemoteCommandRequest, capability: { name: string; risk: string; version: number }): boolean | Promise<boolean>;
}

export interface RemoteCommandExecutor {
  execute(request: RemoteCommandRequest): Promise<void>;
}

export class RemoteCommandGateway {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly policy: RemoteCommandPolicy,
    private readonly executor: RemoteCommandExecutor,
  ) {}

  async dispatch(request: RemoteCommandRequest): Promise<RemoteCommandResult> {
    if (!request.requestId.trim() || !request.deviceId.trim() || !request.capability.trim()) {
      return { status: 'rejected', requestId: request.requestId, reason: 'invalid-request' };
    }

    const capability = this.registry.get(request.capability);
    if (!capability) {
      return { status: 'rejected', requestId: request.requestId, reason: 'unknown-capability' };
    }

    if (!(await this.policy.authorize(request, capability))) {
      return { status: 'rejected', requestId: request.requestId, reason: 'policy-denied' };
    }

    await this.executor.execute(request);
    return { status: 'accepted', requestId: request.requestId };
  }
}
