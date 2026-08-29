import type { RemoteCapability, RemoteDevice, RemoteTransportKind } from './remote.js';

export type DiscoveryProviderKind = 'mdns' | 'ssdp' | 'manual';

export interface DiscoveredRemoteDevice {
  readonly provider: DiscoveryProviderKind;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly addresses: readonly string[];
  readonly ports: readonly number[];
  readonly transports: readonly RemoteTransportKind[];
  readonly capabilities: readonly RemoteCapability[];
  readonly discoveredAt: string;
  readonly identity?: string;
}

export interface RemoteDiscoveryProvider {
  readonly kind: DiscoveryProviderKind;
  discover(): Promise<readonly DiscoveredRemoteDevice[]>;
}

export interface NormalizedRemoteDevice extends RemoteDevice {
  readonly addresses: readonly string[];
  readonly ports: readonly number[];
  readonly discoverySources: readonly DiscoveryProviderKind[];
}

export class RemoteDeviceNormalizer {
  normalize(candidate: DiscoveredRemoteDevice): NormalizedRemoteDevice {
    const identity = candidate.identity?.trim() || candidate.addresses[0]?.trim();
    if (!identity) throw new Error('Discovered device has no stable identity');
    const id = `remote:${identity.toLowerCase()}`;
    if (!candidate.name.trim()) throw new Error('Discovered device name is required');
    if (!candidate.transports.length) throw new Error(`Discovered device has no transport: ${id}`);
    return {
      id,
      name: candidate.name.trim(),
      manufacturer: candidate.manufacturer?.trim() || undefined,
      model: candidate.model?.trim() || undefined,
      transports: [...new Set(candidate.transports)].sort(),
      capabilities: [...new Set(candidate.capabilities)].sort(),
      addresses: [...new Set(candidate.addresses)].sort(),
      ports: [...new Set(candidate.ports)].sort((a, b) => a - b),
      discoverySources: [candidate.provider],
    };
  }

  merge(left: NormalizedRemoteDevice, right: NormalizedRemoteDevice): NormalizedRemoteDevice {
    if (left.id !== right.id) throw new Error('Cannot merge different devices');
    return {
      ...left,
      name: left.name.localeCompare(right.name) <= 0 ? left.name : right.name,
      manufacturer: left.manufacturer || right.manufacturer,
      model: left.model || right.model,
      addresses: [...new Set([...left.addresses, ...right.addresses])].sort(),
      ports: [...new Set([...left.ports, ...right.ports])].sort((a, b) => a - b),
      transports: [...new Set([...left.transports, ...right.transports])].sort(),
      capabilities: [...new Set([...left.capabilities, ...right.capabilities])].sort(),
      discoverySources: [...new Set([...left.discoverySources, ...right.discoverySources])].sort(),
    };
  }
}
