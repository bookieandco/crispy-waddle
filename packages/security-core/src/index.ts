export type SecurityDecision = 'allow' | 'deny' | 'approval_required';

export type SecurityRequest = {
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  projectId?: string;
  resourceId?: string;
  requiresApproval?: boolean;
  nonce: string;
  expiresAt: number;
};

export type CapabilityGrant = {
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type AuditSecurityEvent = {
  id: string;
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  decision: SecurityDecision;
  occurredAt: string;
  previousHash: string;
  eventHash: string;
};

export interface SecurityAuditSink {
  append(event: AuditSecurityEvent): Promise<Pick<AuditSecurityEvent, 'previousHash' | 'eventHash'>>;
}

export type SecurityPolicy = {
  allowedCapabilities: readonly string[];
  approvalCapabilities: readonly string[];
  deniedCapabilities?: readonly string[];
};

const encoder = new TextEncoder();

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class JhadinaSecurityCore {
  private lastAuditHash = 'GENESIS';
  private readonly usedNonces = new Set<string>();

  constructor(private readonly policy: SecurityPolicy) {}

  /** Pure deterministic authorization evaluation. It never consumes replay state. */
  evaluateAuthorization(request: SecurityRequest): SecurityDecision {
    const now = Date.now();
    if (!request.actorId || !request.requestId || !request.nonce) return 'deny';
    if (request.expiresAt <= now) return 'deny';
    if (this.policy.deniedCapabilities?.includes(request.capability)) return 'deny';
    if (!this.policy.allowedCapabilities.includes(request.capability)) return 'deny';
    if (request.requiresApproval || this.policy.approvalCapabilities.includes(request.capability)) return 'approval_required';
    return 'allow';
  }

  /**
   * Synchronous/test compatibility path. Production authorization that spans
   * workers or instances must use authorizeWithReplayGuard().
   */
  authorize(request: SecurityRequest): SecurityDecision {
    const decision = this.evaluateAuthorization(request);
    if (decision === 'deny') return decision;
    if (this.usedNonces.has(request.nonce)) return 'deny';
    this.usedNonces.add(request.nonce);
    return decision;
  }

  /**
   * Production-capable authorization path. Replay ownership is delegated to
   * an atomic durable guard, so a nonce cannot be accepted by two workers.
   */
  async authorizeWithReplayGuard(request: SecurityRequest, replayGuard: NonceReplayGuard): Promise<SecurityDecision> {
    const decision = this.evaluateAuthorization(request);
    if (decision === 'deny') return decision;
    if (!(await replayGuard.consume(request))) return 'deny';
    return decision;
  }

  issueGrant(input: Omit<CapabilityGrant, 'issuedAt'> & { ttlMs?: number }): CapabilityGrant {
    const issuedAt = Date.now();
    return { ...input, issuedAt, expiresAt: Math.min(input.expiresAt, issuedAt + (input.ttlMs ?? 60_000)) };
  }

  /**
   * Compatibility/test-only in-process chain. Production callers must use
   * auditWithSink(), whose sink owns the durable atomic chain head.
   */
  async audit(input: Omit<AuditSecurityEvent, 'previousHash' | 'eventHash'>): Promise<AuditSecurityEvent> {
    const previousHash = this.lastAuditHash;
    const eventHash = await sha256(JSON.stringify({ ...input, previousHash }));
    this.lastAuditHash = eventHash;
    return { ...input, previousHash, eventHash };
  }

  /**
   * Production audit path. The durable sink atomically allocates the chain
   * position and returns the database-computed chain hashes; this instance
   * does not maintain a process-local authoritative chain head.
   */
  async auditWithSink(
    input: Omit<AuditSecurityEvent, 'previousHash' | 'eventHash'>,
    sink: SecurityAuditSink,
  ): Promise<AuditSecurityEvent> {
    const persisted = await sink.append({
      ...input,
      previousHash: 'DURABLE',
      eventHash: 'DURABLE',
    });
    return { ...input, ...persisted };
  }

  validateGrant(grant: CapabilityGrant, request: SecurityRequest): boolean {
    return grant.actorId === request.actorId
      && grant.domain === request.domain
      && grant.capability === request.capability
      && (!grant.resourceId || grant.resourceId === request.resourceId)
      && grant.expiresAt > Date.now();
  }
}

export const JHADINA_BASE_SECURITY_POLICY: SecurityPolicy = {
  allowedCapabilities: [
    'project.create', 'project.edit', 'project.export', 'asset.import',
    'timeline.edit', 'timeline.snapshot', 'take.generate', 'take.regenerate',
    'take.record', 'take.select', 'audio.edit', 'image.edit', 'storyboard.edit',
    'research.run', 'memory.propose', 'memory.read', 'public.publish',
    'growth.draft.approve', 'overage.review',
  ],
  approvalCapabilities: [
    'public.publish', 'paid-ad.publish', 'affiliate.publish',
    'consequential.outreach', 'financial.execute', 'account.connect',
    'credential.rotate', 'memory.commit', 'growth.draft.approve',
  ],
};

export function createSecurityRequest(input: Omit<SecurityRequest, 'nonce' | 'expiresAt'> & { ttlMs?: number }): SecurityRequest {
  const now = Date.now();
  return { ...input, nonce: crypto.randomUUID(), expiresAt: now + (input.ttlMs ?? 30_000) };
}

export * from './replay-guard.js';
export * from './capability-classification.js';
export * from './values-configuration.js';
export * from './risk-boundary-policy.js';