import type { ExecutionRequest, ExecutionResult, ResourceEnforcerPort, RuntimeAdapterPort, RuntimeResourceLease } from './index.js';

/** Runtime families informed by the evaluated sandbox references. */
export type SandboxProviderKind = 'opensandbox' | 'hivebox' | 'native-linux' | 'container' | 'microvm';
export type SandboxControlState = 'active' | 'degraded' | 'unsupported' | 'disabled';

/**
 * Evidence reports what the provider actually enabled for this sandbox.
 * Capability availability is not treated as enforcement evidence.
 */
export interface SandboxIsolationEvidence {
  provider: SandboxProviderKind;
  namespaces: SandboxControlState;
  cgroups: SandboxControlState;
  seccomp: SandboxControlState;
  filesystemIsolation: SandboxControlState;
  networkIsolation: SandboxControlState;
  secureRuntime: 'none' | 'gvisor' | 'kata' | 'firecracker' | 'other';
}

export interface SandboxLease extends RuntimeResourceLease {
  isolation: SandboxIsolationEvidence;
}

/**
 * Physical sandbox boundary. Implementations own lifecycle and platform
 * controls; policy and authorization remain outside this interface.
 */
export interface SandboxProviderPort {
  readonly kind: SandboxProviderKind;
  provision(request: ExecutionRequest): Promise<SandboxLease>;
  execute(request: ExecutionRequest, sandbox: SandboxLease): Promise<ExecutionResult>;
}

export function assertSandboxIsolationEvidence(evidence: SandboxIsolationEvidence): void {
  if (!evidence.provider) throw new Error('Sandbox provider identity is required');
  const required: Array<[keyof SandboxIsolationEvidence, string]> = [
    ['namespaces', 'namespaces'],
    ['cgroups', 'cgroups'],
    ['seccomp', 'seccomp'],
    ['filesystemIsolation', 'filesystem isolation'],
    ['networkIsolation', 'network isolation'],
  ];
  for (const [key, label] of required) if (evidence[key] !== 'active') throw new Error(`Sandbox ${label} is not actively enforced`);
}

function asSandboxLease(lease: RuntimeResourceLease): SandboxLease {
  if (!('isolation' in lease)) throw new Error('Runtime lease lacks sandbox isolation evidence');
  const sandbox = lease as SandboxLease;
  assertSandboxIsolationEvidence(sandbox.isolation);
  return sandbox;
}

/** Adapts a physical sandbox provider to the runtime resource boundary. */
export class SandboxProviderResourceEnforcer implements ResourceEnforcerPort {
  constructor(private readonly provider: SandboxProviderPort) {}
  async acquire(request: ExecutionRequest): Promise<SandboxLease> {
    const lease = await this.provider.provision(request);
    try {
      assertSandboxIsolationEvidence(lease.isolation);
      return lease;
    } catch (error) {
      try { await lease.release(); } catch { /* original validation failure wins */ }
      throw error;
    }
  }
}

/** Adapts the same physical sandbox to the runtime execution boundary. */
export class SandboxProviderRuntimeAdapter implements RuntimeAdapterPort {
  constructor(private readonly provider: SandboxProviderPort) {}
  async execute(request: ExecutionRequest, lease: RuntimeResourceLease): Promise<ExecutionResult> {
    return this.provider.execute(request, asSandboxLease(lease));
  }
}

/**
 * Maps the external reference architectures into Jhadina's single runtime
 * boundary. No provider is selected by untrusted program input.
 */
export const SANDBOX_PROVIDER_GUIDANCE = Object.freeze({
  opensandbox: 'control-plane/data-plane lifecycle, Docker/Kubernetes backends, egress policy, credential proxy, secure runtimes',
  hivebox: 'Linux-native namespaces, cgroups v2, seccomp-BPF, Landlock, pivot_root and capability reduction',
  'native-linux': 'direct Linux kernel isolation; must satisfy the same evidence contract',
  container: 'container runtime isolation; must satisfy the same evidence contract',
  microvm: 'microVM isolation such as Firecracker/Kata; must satisfy the same evidence contract',
} as const);
