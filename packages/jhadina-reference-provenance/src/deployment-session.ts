import { createHash } from 'node:crypto';
import type { ArtifactDeploymentReceipt } from './artifact-deployment.js';

export const ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION =
  'REF-PROV-07' as const;

export type ArtifactRevocationTarget =
  | 'ADMISSION'
  | 'ARTIFACT_PIN'
  | 'ARTIFACT_DIGEST';

export type ArtifactRevocationReceipt = Readonly<{
  schemaVersion: typeof ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION;
  revocationId: string;
  targetType: ArtifactRevocationTarget;
  targetId: string;
  reason: string;
  revokedAt: string;
  supersededBy?: string;
  receiptHash: string;
}>;

export type DeploymentSessionState =
  | 'ACTIVE'
  | 'STOPPED'
  | 'INVALIDATED';

export type DeploymentSession = Readonly<{
  schemaVersion: typeof ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION;
  sessionId: string;
  deploymentId: string;
  subsystem: string;
  runtimeInstanceId: string;
  artifactId: string;
  pinId: string;
  artifactDigest: string;
  admissionId: string;
  admissionReceiptHash: string;
  attestationId: string;
  attestationHash: string;
  state: DeploymentSessionState;
  startedAt: string;
  lastHeartbeatAt: string;
  heartbeatExpiresAt: string;
  stoppedAt?: string;
  invalidatedAt?: string;
  invalidationRevocationId?: string;
  sessionHash: string;
}>;

export type DeploymentSessionEvent = Readonly<{
  eventId: string;
  sessionId: string;
  kind: 'STARTED' | 'HEARTBEAT' | 'STOPPED' | 'INVALIDATED';
  occurredAt: string;
  sessionHash: string;
}>;

export interface DeploymentSessionLedger {
  appendSession(session: DeploymentSession): Promise<void>;
  getSession(sessionId: string): Promise<DeploymentSession | undefined>;
  replaceSession(
    expectedSessionHash: string,
    session: DeploymentSession,
  ): Promise<boolean>;
  appendEvent(event: DeploymentSessionEvent): Promise<void>;
  appendRevocation(receipt: ArtifactRevocationReceipt): Promise<void>;
  getRevocationsForDeployment(
    admissionId: string,
    pinId: string,
    artifactDigest: string,
  ): Promise<readonly ArtifactRevocationReceipt[]>;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .filter((key) => object[key] !== undefined)
    .map((key) => JSON.stringify(key) + ':' + canonical(object[key]))
    .join(',') + '}';
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function iso(value: string, code: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
  return new Date(value).toISOString();
}

function buildSession(
  input: Omit<DeploymentSession, 'schemaVersion' | 'sessionHash'>,
): DeploymentSession {
  const withoutHash = {
    schemaVersion: ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION,
    ...input,
  } as const;
  return Object.freeze({ ...withoutHash, sessionHash: hash(withoutHash) });
}

export function createArtifactRevocation(
  input: Omit<ArtifactRevocationReceipt, 'schemaVersion' | 'receiptHash'>,
): ArtifactRevocationReceipt {
  if (!input.revocationId.trim() || !input.targetId.trim() || !input.reason.trim()) {
    throw new Error('REF_PROV_07_REVOCATION_INVALID');
  }
  const withoutHash = {
    schemaVersion: ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION,
    ...input,
    revokedAt: iso(input.revokedAt, 'REF_PROV_07_REVOCATION_TIME_INVALID'),
  } as const;
  return Object.freeze({ ...withoutHash, receiptHash: hash(withoutHash) });
}

export async function startDeploymentSession(
  ledger: DeploymentSessionLedger,
  deployment: ArtifactDeploymentReceipt,
  input: Readonly<{
    sessionId: string;
    startedAt: string;
    heartbeatTtlMs: number;
  }>,
): Promise<DeploymentSession> {
  if (!input.sessionId.trim() || !Number.isInteger(input.heartbeatTtlMs) || input.heartbeatTtlMs <= 0) {
    throw new Error('REF_PROV_07_SESSION_INPUT_INVALID');
  }
  const startedAt = iso(input.startedAt, 'REF_PROV_07_SESSION_TIME_INVALID');
  const revocations = await ledger.getRevocationsForDeployment(
    deployment.admissionId,
    deployment.pinId,
    deployment.artifactDigest,
  );
  if (revocations.some((item) => Date.parse(item.revokedAt) <= Date.parse(startedAt))) {
    throw new Error('REF_PROV_07_DEPLOYMENT_REVOKED');
  }
  const heartbeatExpiresAt = new Date(
    Date.parse(startedAt) + input.heartbeatTtlMs,
  ).toISOString();
  const session = buildSession({
    sessionId: input.sessionId,
    deploymentId: deployment.deploymentId,
    subsystem: deployment.subsystem,
    runtimeInstanceId: deployment.runtimeInstanceId,
    artifactId: deployment.artifactId,
    pinId: deployment.pinId,
    artifactDigest: deployment.artifactDigest,
    admissionId: deployment.admissionId,
    admissionReceiptHash: deployment.admissionReceiptHash,
    attestationId: deployment.attestationId,
    attestationHash: deployment.attestationHash,
    state: 'ACTIVE',
    startedAt,
    lastHeartbeatAt: startedAt,
    heartbeatExpiresAt,
  });
  await ledger.appendSession(session);
  await ledger.appendEvent({
    eventId: input.sessionId + ':started',
    sessionId: input.sessionId,
    kind: 'STARTED',
    occurredAt: startedAt,
    sessionHash: session.sessionHash,
  });
  return session;
}

async function currentActive(
  ledger: DeploymentSessionLedger,
  sessionId: string,
  at: string,
): Promise<DeploymentSession> {
  const session = await ledger.getSession(sessionId);
  if (!session) throw new Error('REF_PROV_07_SESSION_NOT_FOUND');
  if (session.state !== 'ACTIVE') throw new Error('REF_PROV_07_SESSION_NOT_ACTIVE');
  if (Date.parse(session.heartbeatExpiresAt) <= Date.parse(at)) {
    throw new Error('REF_PROV_07_SESSION_HEARTBEAT_EXPIRED');
  }
  return session;
}

export async function heartbeatDeploymentSession(
  ledger: DeploymentSessionLedger,
  sessionId: string,
  atInput: string,
  heartbeatTtlMs: number,
): Promise<DeploymentSession> {
  const at = iso(atInput, 'REF_PROV_07_HEARTBEAT_TIME_INVALID');
  const session = await currentActive(ledger, sessionId, at);
  if (Date.parse(at) < Date.parse(session.lastHeartbeatAt)) {
    throw new Error('REF_PROV_07_HEARTBEAT_OUT_OF_ORDER');
  }
  const revocations = await ledger.getRevocationsForDeployment(
    session.admissionId,
    session.pinId,
    session.artifactDigest,
  );
  const effective = revocations
    .filter((item) => Date.parse(item.revokedAt) <= Date.parse(at))
    .sort((a, b) => Date.parse(a.revokedAt) - Date.parse(b.revokedAt))[0];
  if (effective) {
    const invalid = buildSession({
      ...session,
      state: 'INVALIDATED',
      lastHeartbeatAt: at,
      heartbeatExpiresAt: at,
      invalidatedAt: at,
      invalidationRevocationId: effective.revocationId,
    });
    if (!(await ledger.replaceSession(session.sessionHash, invalid))) {
      throw new Error('REF_PROV_07_SESSION_CONCURRENT_MUTATION');
    }
    await ledger.appendEvent({
      eventId: sessionId + ':invalidated:' + effective.revocationId,
      sessionId,
      kind: 'INVALIDATED',
      occurredAt: at,
      sessionHash: invalid.sessionHash,
    });
    throw new Error('REF_PROV_07_SESSION_INVALIDATED_BY_REVOCATION');
  }
  if (!Number.isInteger(heartbeatTtlMs) || heartbeatTtlMs <= 0) {
    throw new Error('REF_PROV_07_HEARTBEAT_TTL_INVALID');
  }
  const next = buildSession({
    ...session,
    lastHeartbeatAt: at,
    heartbeatExpiresAt: new Date(Date.parse(at) + heartbeatTtlMs).toISOString(),
  });
  if (!(await ledger.replaceSession(session.sessionHash, next))) {
    throw new Error('REF_PROV_07_SESSION_CONCURRENT_MUTATION');
  }
  await ledger.appendEvent({
    eventId: sessionId + ':heartbeat:' + at,
    sessionId,
    kind: 'HEARTBEAT',
    occurredAt: at,
    sessionHash: next.sessionHash,
  });
  return next;
}

export async function assertDeploymentSessionUsable(
  ledger: DeploymentSessionLedger,
  sessionId: string,
  atInput: string,
): Promise<DeploymentSession> {
  const at = iso(atInput, 'REF_PROV_07_SESSION_CHECK_TIME_INVALID');
  const session = await currentActive(ledger, sessionId, at);
  const revocations = await ledger.getRevocationsForDeployment(
    session.admissionId,
    session.pinId,
    session.artifactDigest,
  );
  if (revocations.some((item) => Date.parse(item.revokedAt) <= Date.parse(at))) {
    throw new Error('REF_PROV_07_SESSION_REVOKED');
  }
  return session;
}

export class InMemoryDeploymentSessionLedger implements DeploymentSessionLedger {
  private readonly sessions = new Map<string, DeploymentSession>();
  private readonly events = new Map<string, DeploymentSessionEvent>();
  private readonly revocations = new Map<string, ArtifactRevocationReceipt>();

  async appendSession(session: DeploymentSession): Promise<void> {
    if (this.sessions.has(session.sessionId)) throw new Error('REF_PROV_07_SESSION_EXISTS');
    this.sessions.set(session.sessionId, session);
  }
  async getSession(sessionId: string): Promise<DeploymentSession | undefined> {
    return this.sessions.get(sessionId);
  }
  async replaceSession(expected: string, session: DeploymentSession): Promise<boolean> {
    const current = this.sessions.get(session.sessionId);
    if (!current || current.sessionHash !== expected) return false;
    this.sessions.set(session.sessionId, session);
    return true;
  }
  async appendEvent(event: DeploymentSessionEvent): Promise<void> {
    const existing = this.events.get(event.eventId);
    if (existing && existing.sessionHash !== event.sessionHash) {
      throw new Error('REF_PROV_07_EVENT_IMMUTABLE');
    }
    this.events.set(event.eventId, event);
  }
  async appendRevocation(receipt: ArtifactRevocationReceipt): Promise<void> {
    const existing = this.revocations.get(receipt.revocationId);
    if (existing && existing.receiptHash !== receipt.receiptHash) {
      throw new Error('REF_PROV_07_REVOCATION_IMMUTABLE');
    }
    this.revocations.set(receipt.revocationId, receipt);
  }
  async getRevocationsForDeployment(admissionId: string, pinId: string, artifactDigest: string) {
    return [...this.revocations.values()].filter((item) =>
      (item.targetType === 'ADMISSION' && item.targetId === admissionId) ||
      (item.targetType === 'ARTIFACT_PIN' && item.targetId === pinId) ||
      (item.targetType === 'ARTIFACT_DIGEST' && item.targetId === artifactDigest),
    );
  }
}
