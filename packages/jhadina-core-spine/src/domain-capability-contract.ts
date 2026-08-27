import type { DomainCapability, JhadinaDomain } from './domain-registry.js';
import type { OperatingContext } from './operating-model.js';

export interface CapabilityRequest {
  domain: string;
  capabilityId: string;
  input: unknown;
  context: OperatingContext;
}

export interface CapabilityResult {
  status: 'completed' | 'needs_approval' | 'rejected' | 'failed';
  output?: unknown;
  reason?: string;
}

export interface DomainCapabilityExecutor {
  execute(request: CapabilityRequest): Promise<CapabilityResult>;
}

export function findCapability(domain: JhadinaDomain, capabilityId: string): DomainCapability | undefined {
  return domain.capabilities.find((capability) => capability.id === capabilityId);
}

export function validateCapabilityRequest(domain: JhadinaDomain, request: CapabilityRequest): DomainCapability {
  if (request.domain !== domain.context.domain) {
    throw new Error(`Domain mismatch: expected ${domain.context.domain}, received ${request.domain}`);
  }
  const capability = findCapability(domain, request.capabilityId);
  if (!capability) throw new Error(`Capability not found: ${request.capabilityId}`);
  return capability;
}
