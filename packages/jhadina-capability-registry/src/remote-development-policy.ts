import type { CapabilityDefinition } from './index.js';
import type { RemoteCommandPolicy, RemoteCommandRequest } from './remote-command-gateway.js';

export interface RemoteDevelopmentPolicyConfig {
  readonly allowedCapabilities?: readonly string[];
  readonly allowedDeviceIds?: readonly string[];
}

/** Explicit development-only policy. Defaults to deny. */
export class RemoteDevelopmentPolicy implements RemoteCommandPolicy {
  private readonly capabilities: ReadonlySet<string>;
  private readonly devices: ReadonlySet<string>;

  constructor(config: RemoteDevelopmentPolicyConfig = {}) {
    this.capabilities = new Set(config.allowedCapabilities ?? []);
    this.devices = new Set(config.allowedDeviceIds ?? []);
  }

  async authorize(request: RemoteCommandRequest, capability: CapabilityDefinition): Promise<boolean> {
    return this.capabilities.has(capability.name) && this.devices.has(request.deviceId);
  }
}
