import { createRemoteAuditEvent, type RemoteAuditSink } from './remote-audit.js';
import { connectAuthorizedSsh, executeAuthorizedSsh } from './ssh-authorized-session.js';
import { evaluateSshPolicy, type SshPolicyRequest, type SshSecurityPolicy } from './ssh-security-policy.js';
import type { RemoteTransport, RemoteTransportRequest, RemoteTransportSession } from './transport-lifecycle.js';

export async function auditedConnectSsh(
  transport: RemoteTransport,
  policy: SshSecurityPolicy,
  request: SshPolicyRequest,
  connection: unknown,
  audit: RemoteAuditSink,
  transportRequest?: RemoteTransportRequest,
): Promise<RemoteTransportSession> {
  const sessionId = crypto.randomUUID();
  await audit.record(createRemoteAuditEvent({ type: 'session.connect.requested', sessionId, protocol: 'ssh', host: request.host, port: request.port }));
  const decision = evaluateSshPolicy(policy, request);
  if (!decision.allowed) {
    await audit.record(createRemoteAuditEvent({ type: 'session.connect.denied', sessionId, protocol: 'ssh', host: request.host, port: request.port, reason: decision.reason }));
    throw new Error(`SSH request denied: ${decision.reason}`);
  }
  const session = await connectAuthorizedSsh(transport, policy, request, connection, {
    ...transportRequest,
    sessionId,
  });
  if (session.sessionId !== sessionId) throw new Error('SSH transport returned an unexpected session identity');
  await audit.record(createRemoteAuditEvent({ type: 'session.connected', sessionId, protocol: 'ssh', host: request.host, port: request.port }));
  return session;
}

export async function auditedExecuteSsh(
  session: RemoteTransportSession,
  policy: SshSecurityPolicy,
  request: SshPolicyRequest & { command: string },
  audit: RemoteAuditSink,
  transportRequest?: RemoteTransportRequest,
): Promise<string> {
  const sessionId = session.sessionId;
  await audit.record(createRemoteAuditEvent({ type: 'command.requested', sessionId, protocol: 'ssh', host: request.host, port: request.port }));
  try {
    const result = await executeAuthorizedSsh(session, policy, request, transportRequest);
    await audit.record(createRemoteAuditEvent({ type: 'command.completed', sessionId, protocol: 'ssh', host: request.host, port: request.port }));
    return result;
  } catch (error) {
    const decision = evaluateSshPolicy(policy, request);
    if (!decision.allowed) {
      await audit.record(createRemoteAuditEvent({ type: 'command.denied', sessionId, protocol: 'ssh', host: request.host, port: request.port, reason: decision.reason }));
    }
    throw error;
  }
}

export async function auditedCloseSsh(
  session: RemoteTransportSession,
  host: string,
  port: number,
  audit: RemoteAuditSink,
): Promise<void> {
  await session.close();
  await audit.record(createRemoteAuditEvent({ type: 'session.closed', sessionId: session.sessionId, protocol: 'ssh', host, port }));
}
