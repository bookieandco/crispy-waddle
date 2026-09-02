import { createHash } from 'node:crypto';

export type ExecutionTrust = 'trusted' | 'untrusted';
export type ExecutionDecision = 'allow' | 'deny';

export interface ResourceLimits {
  maxWallTimeMs: number;
  maxMemoryMb: number;
  maxOutputBytes: number;
  maxCpuMs?: number;
}

export interface ProgramArtifact {
  artifactId: string;
  digestSha256: string;
  mediaType: string;
  trust: ExecutionTrust;
}

export interface ProgramManifest {
  manifestId: string;
  artifactDigestSha256: string;
  entrypoint: string;
  requestedCapabilities: readonly string[];
  resourceLimits: ResourceLimits;
}

/** Capability identity is an attestation reference; authorization remains canonical. */
export interface CapabilityGrantBinding {
  grantId: string;
  capability: string;
}

export interface ExecutionRequest {
  executionId: string;
  actorId: string;
  artifact: ProgramArtifact;
  manifest: ProgramManifest;
  capabilityGrants: readonly CapabilityGrantBinding[];
  requestedAt: string;
}

/** Policy output is authoritative infrastructure state, never an LLM-authored instruction. */
export interface ExecutionPolicy {
  evaluate(request: ExecutionRequest): Promise<ExecutionDecision>;
}

export interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed';
  output?: unknown;
}

export interface RuntimeAdapterPort {
  execute(request: ExecutionRequest, policy: ExecutionPolicy): Promise<ExecutionResult>;
}

export interface ExtensionPatchRegistration {
  patchId: string;
  extensionId: string;
  targetFingerprint: string;
  artifactDigestSha256: string;
  before?: readonly string[];
  after?: readonly string[];
  requestedCapabilities: readonly string[];
}

export interface ExtensionPatchRegistry {
  register(patch: ExtensionPatchRegistration): void;
  list(): readonly ExtensionPatchRegistration[];
}

export interface RuntimeAuditEvent {
  executionId: string;
  actorId: string;
  artifactDigestSha256: string;
  status: 'allowed' | 'denied' | 'completed' | 'failed';
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface RuntimeAuditSink {
  append(event: RuntimeAuditEvent): Promise<void>;
}

export function assertResourceLimits(limits: ResourceLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      throw new Error(`Invalid runtime resource limit: ${name}`);
    }
  }
}

export function assertManifestMatchesArtifact(artifact: ProgramArtifact, manifest: ProgramManifest): void {
  if (artifact.digestSha256 !== manifest.artifactDigestSha256) {
    throw new Error('Runtime artifact/manifest digest mismatch');
  }
  assertResourceLimits(manifest.resourceLimits);
  if (!manifest.entrypoint.trim()) throw new Error('Runtime manifest entrypoint is required');
}

export function assertExecutionRequest(request: ExecutionRequest): void {
  if (!request.actorId.trim()) throw new Error('Runtime actor binding is required');
  if (!request.executionId.trim()) throw new Error('Runtime executionId is required');
  if (request.artifact.trust !== 'trusted') throw new Error('Untrusted program artifacts cannot be executed');
  assertManifestMatchesArtifact(request.artifact, request.manifest);
  if (request.manifest.requestedCapabilities.length !== request.capabilityGrants.length) {
    throw new Error('Runtime capability grants must explicitly bind every requested capability');
  }
  const declared = new Set(request.manifest.requestedCapabilities);
  for (const grant of request.capabilityGrants) {
    if (!grant.grantId.trim() || !declared.has(grant.capability)) {
      throw new Error('Runtime capability grant is not bound to a declared capability');
    }
  }
}

/** Stable, content-derived execution identity. */
export function deriveExecutionId(input: {
  actorId: string;
  artifactDigestSha256: string;
  manifestId: string;
  requestedAt: string;
}): string {
  const canonical = [input.actorId, input.artifactDigestSha256, input.manifestId, input.requestedAt].join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Metadata-only registry; registration never loads or executes patch code. */
export class InMemoryExtensionPatchRegistry implements ExtensionPatchRegistry {
  private readonly patches = new Map<string, ExtensionPatchRegistration>();

  register(patch: ExtensionPatchRegistration): void {
    if (!patch.patchId || !patch.extensionId || !patch.targetFingerprint || !patch.artifactDigestSha256) {
      throw new Error('Incomplete extension patch registration');
    }
    if (this.patches.has(patch.patchId)) throw new Error(`Duplicate extension patch: ${patch.patchId}`);
    this.patches.set(patch.patchId, Object.freeze({
      ...patch,
      before: Object.freeze([...(patch.before ?? [])]),
      after: Object.freeze([...(patch.after ?? [])]),
      requestedCapabilities: Object.freeze([...patch.requestedCapabilities]),
    }));
  }

  list(): readonly ExtensionPatchRegistration[] { return [...this.patches.values()]; }
}

/** No arbitrary uploaded source is compiled, loaded, or executed by this core. */
export const RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION = true as const;
