import type { CapabilityDefinition, CapabilityRegistry } from '../../jhadina-capability-registry/src/index.js';

export const REMOTE_ACCESS_CAPABILITY = 'remote.access';

export const remoteAccessCapability: CapabilityDefinition = Object.freeze({
  name: REMOTE_ACCESS_CAPABILITY,
  description: 'Open and manage explicitly authorized remote sessions through registered protocol providers.',
  risk: 'external',
  version: 1,
});

export function registerRemoteAccessCapability(registry: CapabilityRegistry): void {
  if (!registry.has(REMOTE_ACCESS_CAPABILITY)) {
    registry.register(remoteAccessCapability);
  }
}
