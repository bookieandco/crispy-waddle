import type { ExecutionRequest, ExecutionResult, ResourceLimits } from './index.js';
import { assertSandboxIsolationEvidence, type SandboxIsolationEvidence, type SandboxLease, type SandboxProviderPort } from './sandbox-provider.js';
import { deriveResourceLimitsDigest } from './resource-enforcement.js';

export interface OpenSandboxImageResolverPort { resolve(artifactDigestSha256: string): Promise<string | undefined>; }
export type OpenSandboxSandboxStatus = 'pending' | 'running' | 'paused' | 'stopping' | 'terminated' | 'failed';
export interface OpenSandboxRuntimeAttestation { sandboxId: string; executionId: string; isolation: SandboxIsolationEvidence; }
export interface OpenSandboxCreateRequest { image: string; executionId: string; resourceLimits: ResourceLimits; }
export interface OpenSandboxHandle { sandboxId: string; status: OpenSandboxSandboxStatus; attestation: OpenSandboxRuntimeAttestation | undefined; }
export interface OpenSandboxClientPort { createSandbox(request: OpenSandboxCreateRequest): Promise<OpenSandboxHandle>; getSandbox(sandboxId: string): Promise<OpenSandboxHandle>; execute(sandboxId: string, request: ExecutionRequest): Promise<ExecutionResult>; deleteSandbox(sandboxId: string): Promise<void>; }
export interface OpenSandboxProviderOptions { client: OpenSandboxClientPort; imageResolver: OpenSandboxImageResolverPort; requireSecureRuntime?: boolean; }

function assertRunning(handle: OpenSandboxHandle): void { if (handle.status !== 'running') throw new Error(`OpenSandbox sandbox is not running: ${handle.status}`); }
function assertAttestation(handle: OpenSandboxHandle, executionId: string, requireSecureRuntime: boolean): SandboxIsolationEvidence {
  const attestation = handle.attestation;
  if (!attestation) throw new Error('OpenSandbox runtime attestation is required');
  if (attestation.sandboxId !== handle.sandboxId) throw new Error('OpenSandbox attestation sandbox identity mismatch');
  if (attestation.executionId !== executionId) throw new Error('OpenSandbox attestation execution identity mismatch');
  assertSandboxIsolationEvidence(attestation.isolation);
  if (requireSecureRuntime && attestation.isolation.secureRuntime === 'none') throw new Error('OpenSandbox secure runtime is required');
  return attestation.isolation;
}

export interface OpenSandboxLease extends SandboxLease { sandboxId: string; }

export class OpenSandboxProvider implements SandboxProviderPort {
  readonly kind = 'opensandbox' as const;
  private readonly client: OpenSandboxClientPort;
  private readonly imageResolver: OpenSandboxImageResolverPort;
  private readonly requireSecureRuntime: boolean;
  constructor(options: OpenSandboxProviderOptions) { this.client = options.client; this.imageResolver = options.imageResolver; this.requireSecureRuntime = options.requireSecureRuntime ?? false; }

  async provision(request: ExecutionRequest): Promise<OpenSandboxLease> {
    const image = await this.imageResolver.resolve(request.artifact.digestSha256);
    if (!image) throw new Error(`No trusted OpenSandbox image mapping for artifact: ${request.artifact.digestSha256}`);
    const handle = await this.client.createSandbox({ image, executionId: request.executionId, resourceLimits: request.manifest.resourceLimits });
    try {
      assertRunning(handle);
      const isolation = assertAttestation(handle, request.executionId, this.requireSecureRuntime);
      return {
        sandboxId: handle.sandboxId,
        executionId: request.executionId,
        limits: request.manifest.resourceLimits,
        enforcement: { executionId: request.executionId, limitsDigestSha256: deriveResourceLimitsDigest(request.executionId, request.manifest.resourceLimits), dimensions: { wallTime: 'enforced', memory: 'enforced', output: 'enforced', ...(request.manifest.resourceLimits.maxCpuMs !== undefined ? { cpu: 'enforced' as const } : {}) } },
        isolation,
        release: async () => { await this.client.deleteSandbox(handle.sandboxId); },
      };
    } catch (error) {
      try { await this.client.deleteSandbox(handle.sandboxId); } catch { /* preserve original lifecycle failure */ }
      throw error;
    }
  }

  async execute(request: ExecutionRequest, sandbox: SandboxLease): Promise<ExecutionResult> {
    const bound = sandbox as OpenSandboxLease;
    if (typeof bound.sandboxId !== 'string' || !bound.sandboxId.trim()) throw new Error('OpenSandbox lease must contain a sandbox id');
    if (bound.executionId !== request.executionId) throw new Error('OpenSandbox lease execution identity mismatch');
    assertSandboxIsolationEvidence(bound.isolation);
    const current = await this.client.getSandbox(bound.sandboxId);
    assertRunning(current);
    assertAttestation(current, request.executionId, this.requireSecureRuntime);
    return this.client.execute(bound.sandboxId, request);
  }
}
