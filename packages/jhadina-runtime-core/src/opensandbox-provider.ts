import type { ExecutionRequest, ExecutionResult, ResourceLimits } from './index.js';
import { assertSandboxIsolationEvidence, type SandboxIsolationEvidence, type SandboxLease, type SandboxProviderPort } from './sandbox-provider.js';

/** Trusted mapping from an approved artifact digest to an approved sandbox image. */
export interface OpenSandboxImageResolverPort {
  resolve(artifactDigestSha256: string): Promise<string | undefined>;
}

export type OpenSandboxSandboxStatus = 'pending' | 'running' | 'paused' | 'stopping' | 'terminated' | 'failed';

export interface OpenSandboxRuntimeAttestation {
  sandboxId: string;
  executionId: string;
  isolation: SandboxIsolationEvidence;
}

export interface OpenSandboxCreateRequest {
  image: string;
  executionId: string;
  resourceLimits: ResourceLimits;
}

export interface OpenSandboxHandle {
  sandboxId: string;
  status: OpenSandboxSandboxStatus;
  attestation: OpenSandboxRuntimeAttestation | undefined;
}

/** Transport boundary. HTTP/SDK implementation belongs outside runtime-core. */
export interface OpenSandboxClientPort {
  createSandbox(request: OpenSandboxCreateRequest): Promise<OpenSandboxHandle>;
  getSandbox(sandboxId: string): Promise<OpenSandboxHandle>;
  execute(sandboxId: string, request: ExecutionRequest): Promise<ExecutionResult>;
  deleteSandbox(sandboxId: string): Promise<void>;
}

export interface OpenSandboxProviderOptions {
  client: OpenSandboxClientPort;
  imageResolver: OpenSandboxImageResolverPort;
  requireSecureRuntime?: boolean;
}

function assertRunning(handle: OpenSandboxHandle): void {
  if (handle.status !== 'running') throw new Error(`OpenSandbox sandbox is not running: ${handle.status}`);
}

function assertAttestation(handle: OpenSandboxHandle, executionId: string, requireSecureRuntime: boolean): SandboxIsolationEvidence {
  const attestation = handle.attestation;
  if (!attestation) throw new Error('OpenSandbox runtime attestation is required');
  if (attestation.sandboxId !== handle.sandboxId) throw new Error('OpenSandbox attestation sandbox identity mismatch');
  if (attestation.executionId !== executionId) throw new Error('OpenSandbox attestation execution identity mismatch');
  assertSandboxIsolationEvidence(attestation.isolation);
  if (requireSecureRuntime && attestation.isolation.secureRuntime === 'none') throw new Error('OpenSandbox secure runtime is required');
  return attestation.isolation;
}

export class OpenSandboxProvider implements SandboxProviderPort {
  readonly kind = 'opensandbox' as const;
  private readonly client: OpenSandboxClientPort;
  private readonly imageResolver: OpenSandboxImageResolverPort;
  private readonly requireSecureRuntime: boolean;

  constructor(options: OpenSandboxProviderOptions) {
    this.client = options.client;
    this.imageResolver = options.imageResolver;
    this.requireSecureRuntime = options.requireSecureRuntime ?? false;
  }

  async provision(request: ExecutionRequest): Promise<SandboxLease> {
    const image = await this.imageResolver.resolve(request.artifact.digestSha256);
    if (!image) throw new Error(`No trusted OpenSandbox image mapping for artifact: ${request.artifact.digestSha256}`);

    const handle = await this.client.createSandbox({ image, executionId: request.executionId, resourceLimits: request.manifest.resourceLimits });
    try {
      assertRunning(handle);
      const isolation = assertAttestation(handle, request.executionId, this.requireSecureRuntime);
      return {
        executionId: request.executionId,
        limits: request.manifest.resourceLimits,
        enforcement: {
          executionId: request.executionId,
          limitsDigestSha256: '',
          dimensions: { wallTime: 'enforced', memory: 'enforced', output: 'enforced', ...(request.manifest.resourceLimits.maxCpuMs !== undefined ? { cpu: 'enforced' as const } : {}) },
        },
        isolation,
        release: async () => { await this.client.deleteSandbox(handle.sandboxId); },
      };
    } catch (error) {
      try { await this.client.deleteSandbox(handle.sandboxId); } catch { /* preserve attestation/lifecycle failure */ }
      throw error;
    }
  }

  async execute(request: ExecutionRequest, sandbox: SandboxLease): Promise<ExecutionResult> {
    if (sandbox.executionId !== request.executionId) throw new Error('OpenSandbox lease execution identity mismatch');
    assertSandboxIsolationEvidence(sandbox.isolation);
    const current = await this.client.getSandbox(this.requireSandboxId(sandbox));
    assertRunning(current);
    assertAttestation(current, request.executionId, this.requireSecureRuntime);
    return this.client.execute(this.requireSandboxId(sandbox), request);
  }

  private requireSandboxId(sandbox: SandboxLease): string {
    const candidate = (sandbox as SandboxLease & { sandboxId?: unknown }).sandboxId;
    if (typeof candidate !== 'string' || !candidate.trim()) throw new Error('OpenSandbox lease must contain a sandbox id');
    return candidate;
  }
}
