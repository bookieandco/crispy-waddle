import { createHash } from 'node:crypto';
import { assertResourceLimits, type ExecutionRequest, type ResourceLimits, type RuntimeResourceLease } from './index.js';

export type ResourceDimension = 'wallTime' | 'memory' | 'output' | 'cpu';
export type ResourceEnforcementStatus = 'enforced';

export interface ResourceEnforcementReceipt {
  executionId: string;
  limitsDigestSha256: string;
  dimensions: Readonly<Record<ResourceDimension, ResourceEnforcementStatus>>;
}

export interface AttestedRuntimeResourceLease extends RuntimeResourceLease {
  receipt: ResourceEnforcementReceipt;
}

export function deriveResourceLimitsDigest(executionId: string, limits: ResourceLimits): string {
  assertResourceLimits(limits);
  return createHash('sha256').update(JSON.stringify({ executionId, limits }), 'utf8').digest('hex');
}

export function assertResourceEnforcementReceipt(request: ExecutionRequest, lease: AttestedRuntimeResourceLease): void {
  if (lease.executionId !== request.executionId) throw new Error('Resource lease execution binding mismatch');
  if (lease.enforcement !== 'enforced') throw new Error('Resource enforcement is not attested');
  const expected = deriveResourceLimitsDigest(request.executionId, request.manifest.resourceLimits);
  if (lease.receipt.executionId !== request.executionId || lease.receipt.limitsDigestSha256 !== expected) throw new Error('Resource enforcement receipt does not bind requested limits');
  const dimensions: ResourceDimension[] = ['wallTime', 'memory', 'output'];
  if (request.manifest.resourceLimits.maxCpuMs !== undefined) dimensions.push('cpu');
  for (const dimension of dimensions) if (lease.receipt.dimensions[dimension] !== 'enforced') throw new Error(`Resource dimension is not enforced: ${dimension}`);
}
