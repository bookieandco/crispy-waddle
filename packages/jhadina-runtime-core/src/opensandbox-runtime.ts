import type {
  ExecutionPolicy,
  RuntimeAuditSink,
  RuntimeExecutionClock,
} from './index.js';
import { GovernedRuntimeExecutor } from './runtime-executor.js';
import { OpenSandboxProvider, type OpenSandboxClientPort, type OpenSandboxImageResolverPort } from './opensandbox-provider.js';
import { SandboxProviderResourceEnforcer, SandboxProviderRuntimeAdapter } from './sandbox-provider.js';

export interface OpenSandboxGovernedRuntimeOptions {
  policy: ExecutionPolicy;
  audit: RuntimeAuditSink;
  client: OpenSandboxClientPort;
  imageResolver: OpenSandboxImageResolverPort;
  requireSecureRuntime?: boolean;
  clock?: RuntimeExecutionClock;
}

/**
 * Production composition root for governed runtime execution.
 *
 * Provider selection is intentionally absent from the execution request. The
 * composition root binds the complete execution path to OpenSandbox once:
 * GovernedRuntimeExecutor -> SandboxProviderResourceEnforcer -> OpenSandboxProvider
 *                         -> SandboxProviderRuntimeAdapter -> OpenSandboxProvider
 *
 * A caller cannot select a weaker provider by changing artifact or request data.
 */
export function createOpenSandboxGovernedRuntimeExecutor(
  options: OpenSandboxGovernedRuntimeOptions,
): GovernedRuntimeExecutor {
  const provider = new OpenSandboxProvider({
    client: options.client,
    imageResolver: options.imageResolver,
    requireSecureRuntime: options.requireSecureRuntime,
  });

  return new GovernedRuntimeExecutor(
    options.policy,
    new SandboxProviderRuntimeAdapter(provider),
    options.audit,
    new SandboxProviderResourceEnforcer(provider),
    options.clock,
  );
}
