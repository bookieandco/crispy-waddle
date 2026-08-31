import type { CapabilityRegistry } from './index.js';
import type { RemoteCommandRequest } from './remote-command-gateway.js';

export interface ResolvedRemoteCommand {
  readonly requestId: string;
  readonly deviceId: string;
  readonly capability: string;
  readonly payload?: unknown;
}

export interface RemoteResolver {
  resolve(request: RemoteCommandRequest): ResolvedRemoteCommand;
}

export class DeterministicRemoteResolver implements RemoteResolver {
  constructor(private readonly registry: CapabilityRegistry) {}

  resolve(request: RemoteCommandRequest): ResolvedRemoteCommand {
    if (!this.registry.has(request.capability)) throw new Error(`Unknown capability: ${request.capability}`);
    return Object.freeze({
      requestId: request.requestId,
      deviceId: request.deviceId,
      capability: request.capability,
      ...(request.payload === undefined ? {} : { payload: request.payload }),
    });
  }
}
