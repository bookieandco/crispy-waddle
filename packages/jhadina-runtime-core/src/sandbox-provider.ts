import type { ExecutionRequest, ExecutionResult, RuntimeResourceLease } from './index.js';

/** Runtime families informed by the evaluated sandbox references. */
export type SandboxProviderKind = 'opensandbox' | 'hivebox' | 'native-linux' | 'container' | 'microvm';

/**
 * Evidence must describe controls the provider actually enabled. It is not a
 * declaration that a provider could support them.
 */
export interface SandboxIsolationEvidence {
  provider: SandboxProviderKind;
  namespaces: boolean;
  cgroups: boolean;
  seccomp: boolean;
  filesystemIsolation: boolean;
  networkIsolation: boolean;
  secureRuntime: 'none' | 'gvisor' | 'kata' | 'firecracker' | 'other';
}

export interface SandboxLease extends RuntimeResourceLease {
  isolation: SandboxIsolationEvidence;
  destroy(): Promise<void>;
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
  if (!evidence.namespaces) throw new Error('Sandbox namespaces are not enforced');
  if (!evidence.cgroups) throw new Error('Sandbox cgroups are not enforced');
  if (!evidence.seccomp) throw new Error('Sandbox seccomp is not enforced');
  if (!evidence.filesystemIsolation) throw new Error('Sandbox filesystem isolation is not enforced');
  if (!evidence.networkIsolation) throw new Error('Sandbox network isolation is not enforced');
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
