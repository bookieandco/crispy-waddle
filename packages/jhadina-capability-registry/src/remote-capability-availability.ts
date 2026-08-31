import type { CapabilityRegistry } from './index.js';
import type { ResolvedRemoteCommand } from './remote-resolver.js';
import type { RemoteTransport } from './remote-transport.js';

export interface RemoteCapabilityAvailability {
  readonly name: string;
  readonly available: boolean;
}

export function listRemoteCapabilityAvailability(
  registry: CapabilityRegistry,
  transports: readonly RemoteTransport[],
  deviceId: string,
): readonly RemoteCapabilityAvailability[] {
  return registry.list().map(({ name }) => {
    const command = { requestId: 'availability-check', deviceId, capability: name, resolved: true } satisfies ResolvedRemoteCommand;
    return { name, available: transports.some(transport => transport.supports(command)) };
  });
}
