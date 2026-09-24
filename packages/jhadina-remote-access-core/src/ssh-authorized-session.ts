import { evaluateSshPolicy, type SshPolicyRequest, type SshSecurityPolicy } from './ssh-security-policy.js';
import type { RemoteTransport, RemoteTransportRequest, RemoteTransportSession } from './transport-lifecycle.js';

export class SshAuthorizationError extends Error {
  constructor(readonly reason: NonNullable<ReturnType<typeof evaluateSshPolicy>['reason']>) {
    super(`SSH request denied: ${reason}`);
    this.name = 'SshAuthorizationError';
  }
}

export async function connectAuthorizedSsh(
  transport: RemoteTransport,
  policy: SshSecurityPolicy,
  request: SshPolicyRequest,
  connection: unknown,
  transportRequest?: RemoteTransportRequest,
): Promise<RemoteTransportSession> {
  const decision = evaluateSshPolicy(policy, request);
  if (!decision.allowed) throw new SshAuthorizationError(decision.reason!);
  return transport.connect(connection, transportRequest);
}

export async function executeAuthorizedSsh(
  session: RemoteTransportSession,
  policy: SshSecurityPolicy,
  request: SshPolicyRequest,
  transportRequest?: RemoteTransportRequest,
): Promise<string> {
  const decision = evaluateSshPolicy(policy, request);
  if (!decision.allowed) throw new SshAuthorizationError(decision.reason!);
  if (!request.command) throw new SshAuthorizationError('command-not-allowed');
  return session.execute(request.command, transportRequest);
}
