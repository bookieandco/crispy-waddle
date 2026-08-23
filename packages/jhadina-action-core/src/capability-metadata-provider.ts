import type { ActionRequest } from './action-executor.js';
import type { CapabilityDefinition, CapabilityRegistry } from '@jhadina/capability-registry';

export interface CapabilityMetadataProvider {
  get(name: string): CapabilityDefinition | undefined;
}

export class RegistryCapabilityMetadataProvider implements CapabilityMetadataProvider {
  constructor(private readonly registry: CapabilityRegistry) {}

  get(name: string): CapabilityDefinition | undefined {
    return this.registry.get(name);
  }
}

export function requireRegisteredCapability(
  provider: CapabilityMetadataProvider,
  request: Pick<ActionRequest, 'type'>,
): CapabilityDefinition {
  const capability = provider.get(request.type);
  if (!capability) {
    throw new Error(`Unknown capability: ${request.type}`);
  }
  return capability;
}
