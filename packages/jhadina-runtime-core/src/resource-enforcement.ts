import { createHash } from 'node:crypto';
import type { ExecutionRequest, ResourceLimits, RuntimeResourceLease } from './index.js';

export type ResourceDimension = 'wallTime' | 'memory' | 'output' | 'cpu';
export type ResourceEnforcementStatus = 'enforced';

export interface ResourceEnforcementReceipt {
  executionId: string;
  limitsDigestSha256: string;
  dimensions: Readonly<Record<ResourceDimension, ResourceEnforcementStatus>>;
}

export interface AttestedRuntimeResourceLease extends RuntimeResourceLease {
  enforcement: ResourceEnforcementReceipt;
}

function assertLimitsForAttestation(limits: ResourceLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      throw new Error(`Invalid runtime resource limit: ${name}`);
    }
  }
}

export function deriveResourceLimitsDigest(executionId: string, limits: ResourceLimits): string {
  assertLimitsForAttestation(limits);
  const canonical = [
    executionId,
    String(limits.maxWallTimeMs),
    String(limits.maxMemoryMb),
    String(limits.maxOutputBytes),
    limits.maxCpuMs === undefined ? 'none' : String(limits.maxCpuMs),
  ].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function assertResourceEnforcementReceipt(request: ExecutionRequest, lease: AttestedRuntimeResourceLease): void {
  if (lease.executionId !== request.executionId) throw new Error('Resource lease execution binding mismatch');
  if (lease.enforcement?.executionId !== request.executionId) throw new Error('Resource enforcement receipt execution binding mismatch');
  const expected = deriveResourceLimitsDigest(request.executionId, request.manifest.resourceLimits);
  if (lease.enforcement.limitsDigestSha256 !== expected) throw new Error('Resource enforcement receipt does not bind requested limits');
  const dimensions: ResourceDimension[] = ['wallTime', 'memory', 'output'];
  if (request.manifest.resourceLimits.maxCpuMs !== undefined) dimensions.push('cpu');
  for (const dimension of dimensions) {
    if (lease.enforcement.dimensions[dimension] !== 'enforced') {
      throw new Error(`Resource dimension is not enforced: ${dimension}`);
    }
  }
}