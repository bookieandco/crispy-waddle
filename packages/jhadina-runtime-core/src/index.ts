import { createHash } from 'node:crypto';

export type ExecutionTrust = 'trusted' | 'untrusted';
export type ExecutionDecision = 'allow' | 'deny';

export interface ResourceLimits { maxWallTimeMs: number; maxMemoryMb: number; maxOutputBytes: number; maxCpuMs?: number; }
export type ResourceDimension = 'wallTime' | 'memory' | 'output' | 'cpu';
export type ResourceEnforcementStatus = 'enforced';
export interface ResourceEnforcementReceipt {
  executionId: string;
  limitsDigestSha256: string;
  dimensions: Readonly<Record<ResourceDimension, ResourceEnforcementStatus>>;
}
export interface ProgramArtifact { artifactId: string; digestSha256: string; mediaType: string; trust: ExecutionTrust; }
export interface ProgramManifest { manifestId: string; artifactDigestSha256: string; entrypoint: string; requestedCapabilities: readonly string[]; resourceLimits: ResourceLimits; }
/** Capability identity is an attestation reference; authorization remains canonical. */
export interface CapabilityGrantBinding { grantId: string; capability: string; }
export interface ExecutionRequest { executionId: string; actorId: string; artifact: ProgramArtifact; manifest: ProgramManifest; capabilityGrants: readonly CapabilityGrantBinding[]; requestedAt: string; }
/** Policy output is authoritative infrastructure state, never an LLM-authored instruction. */
export interface ExecutionPolicy { evaluate(request: ExecutionRequest): Promise<ExecutionDecision>; }
export interface ExecutionResult { executionId: string; status: 'completed' | 'failed'; output?: unknown; }

/** Runtime adapters receive a cryptographically bound enforcement attestation, not a generic marker. */
export interface RuntimeAdapterPort { execute(request: ExecutionRequest, lease: RuntimeResourceLease): Promise<ExecutionResult>; }
export interface RuntimeResourceLease {
  executionId: string;
  limits: ResourceLimits;
  enforcement: ResourceEnforcementReceipt;
  release(): Promise<void>;
}
/** Resource acquisition is an enforcement boundary; a reservation without attestation is invalid. */
export interface ResourceEnforcerPort { acquire(request: ExecutionRequest): Promise<RuntimeResourceLease>; }

export interface ExtensionPatchRegistration { patchId: string; extensionId: string; targetFingerprint: string; artifactDigestSha256: string; before?: readonly string[]; after?: readonly string[]; requestedCapabilities: readonly string[]; }
export interface ExtensionPatchRegistry { register(patch: ExtensionPatchRegistration): void; list(): readonly ExtensionPatchRegistration[]; }
export interface RuntimeAuditEvent { executionId: string; actorId: string; artifactDigestSha256: string; status: 'allowed' | 'denied' | 'completed' | 'failed'; occurredAt: string; metadata?: Readonly<Record<string, unknown>>; }
export interface RuntimeAuditSink { append(event: RuntimeAuditEvent): Promise<void>; }
export function assertResourceLimits(limits: ResourceLimits): void { for (const [name, value] of Object.entries(limits)) if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) throw new Error(`Invalid runtime resource limit: ${name}`); }
export function assertManifestMatchesArtifact(artifact: ProgramArtifact, manifest: ProgramManifest): void { if (artifact.digestSha256 !== manifest.artifactDigestSha256) throw new Error('Runtime artifact/manifest digest mismatch'); assertResourceLimits(manifest.resourceLimits); if (!manifest.entrypoint.trim()) throw new Error('Runtime manifest entrypoint is required'); }
export function deriveExecutionId(input: { actorId: string; artifactDigestSha256: string; manifestId: string; requestedAt: string }): string { return createHash('sha256').update([input.actorId, input.artifactDigestSha256, input.manifestId, input.requestedAt].join('\n'), 'utf8').digest('hex'); }
export function assertExecutionRequest(request: ExecutionRequest): void {
  if (!request.actorId.trim()) throw new Error('Runtime actor binding is required');
  if (!request.executionId.trim()) throw new Error('Runtime executionId is required');
  if (request.artifact.trust !== 'trusted') throw new Error('Untrusted program artifacts cannot be executed');
  assertManifestMatchesArtifact(request.artifact, request.manifest);
  const expected = deriveExecutionId({ actorId: request.actorId, artifactDigestSha256: request.artifact.digestSha256, manifestId: request.manifest.manifestId, requestedAt: request.requestedAt });
  if (request.executionId !== expected) throw new Error('Runtime executionId must match deterministic request identity');
  const declared = new Set(request.manifest.requestedCapabilities); const granted = new Set(request.capabilityGrants.map((grant) => grant.capability));
  if (declared.size !== request.manifest.requestedCapabilities.length || granted.size !== request.capabilityGrants.length) throw new Error('Runtime capabilities and grants must be unique');
  if (declared.size !== granted.size || [...declared].some((capability) => !granted.has(capability))) throw new Error('Runtime capability grants must exactly bind declared capabilities');
  for (const grant of request.capabilityGrants) if (!grant.grantId.trim()) throw new Error('Runtime capability grant id is required');
}
/** Metadata-only registry; registration never loads or executes patch code. */
export class InMemoryExtensionPatchRegistry implements ExtensionPatchRegistry {
  private readonly patches = new Map<string, ExtensionPatchRegistration>();
  register(patch: ExtensionPatchRegistration): void { if (!patch.patchId || !patch.extensionId || !patch.targetFingerprint || !patch.artifactDigestSha256) throw new Error('Incomplete extension patch registration'); if (this.patches.has(patch.patchId)) throw new Error(`Duplicate extension patch: ${patch.patchId}`); this.patches.set(patch.patchId, Object.freeze({ ...patch, before: Object.freeze([...(patch.before ?? [])]), after: Object.freeze([...(patch.after ?? [])]), requestedCapabilities: Object.freeze([...patch.requestedCapabilities]) })); }
  list(): readonly ExtensionPatchRegistration[] { return [...this.patches.values()]; }
}
export const RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION = true as const;
export { GovernedRuntimeExecutor } from './runtime-executor.js';
export type { RuntimeExecutionClock } from './runtime-executor.js';
export { assertResourceEnforcementReceipt, deriveResourceLimitsDigest } from './resource-enforcement.js';
export type { AttestedRuntimeResourceLease } from './resource-enforcement.js';
export { assertSandboxIsolationEvidence } from './sandbox-provider.js';
export type { SandboxProviderKind, SandboxIsolationEvidence, SandboxLease, SandboxProviderPort } from './sandbox-provider.js';
export { SANDBOX_PROVIDER_GUIDANCE } from './sandbox-provider.js';