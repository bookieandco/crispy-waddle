export type CredentialLease = {
  leaseId: string;
  actorId: string;
  workerId: string;
  domain: string;
  capability: string;
  credentialRef: string;
  resourceId?: string;
  issuedAt: number;
  expiresAt: number;
};

export type CredentialLeaseRequest = {
  actorId: string;
  workerId: string;
  domain: string;
  capability: string;
  credentialRef: string;
  resourceId?: string;
  ttlMs?: number;
  nowMs?: number;
};

export type CredentialLeaseBinding = Pick<CredentialLease, 'actorId' | 'workerId' | 'domain' | 'capability' | 'credentialRef' | 'resourceId'>;

export type CredentialSecretStore = {
  resolve(credentialRef: string): Promise<string>;
};

export type CredentialLeaseStore = {
  issue(lease: CredentialLease): Promise<void>;
  /** Atomically consumes a lease. Binding is part of the compare/delete operation. */
  consume(leaseId: string, binding: CredentialLeaseBinding, nowMs: number): Promise<CredentialLease | null>;
};

export type CredentialBrokerGate = {
  authorize(input: CredentialLeaseRequest): Promise<'allow' | 'deny'> | 'allow' | 'deny';
  allowTraffic?: () => Promise<boolean> | boolean;
  allowCredentialEgress?: (input: CredentialLeaseRequest) => Promise<boolean> | boolean;
};

/**
 * CredentialBroker is the only abstraction that turns a scoped credential
 * reference into secret material. Leases contain metadata only; secret values
 * are resolved just-in-time during consume() and are never part of a lease.
 *
 * Production deployments must provide a durable CredentialLeaseStore whose
 * consume operation atomically compares the complete binding across instances.
 * InMemoryCredentialLeaseStore below is explicitly test-only.
 */
export class CredentialBroker {
  private readonly maxTtlMs: number;

  constructor(
    private readonly secrets: CredentialSecretStore,
    private readonly leases: CredentialLeaseStore,
    private readonly gate: CredentialBrokerGate,
    options: { maxTtlMs?: number } = {},
  ) {
    this.maxTtlMs = options.maxTtlMs ?? 60_000;
  }

  async issue(request: CredentialLeaseRequest): Promise<CredentialLease> {
    validateRequest(request);
    const authorized = await this.gate.authorize(request);
    if (authorized !== 'allow') throw new Error('CREDENTIAL_LEASE_DENIED');
    if (this.gate.allowTraffic && !(await this.gate.allowTraffic())) throw new Error('CREDENTIAL_TRAFFIC_BLOCKED');
    if (this.gate.allowCredentialEgress && !(await this.gate.allowCredentialEgress(request))) throw new Error('CREDENTIAL_EGRESS_BLOCKED');

    const nowMs = request.nowMs ?? Date.now();
    const ttlMs = Math.min(request.ttlMs ?? 30_000, this.maxTtlMs);
    const lease: CredentialLease = {
      leaseId: crypto.randomUUID(),
      actorId: request.actorId,
      workerId: request.workerId,
      domain: request.domain,
      capability: request.capability,
      credentialRef: request.credentialRef,
      ...(request.resourceId ? { resourceId: request.resourceId } : {}),
      issuedAt: nowMs,
      expiresAt: nowMs + ttlMs,
    };

    await this.leases.issue(lease);
    return lease;
  }

  async consume(lease: CredentialLease, binding: CredentialLeaseBinding, nowMs = Date.now()): Promise<string> {
    assertBinding(lease, binding);
    if (lease.expiresAt <= nowMs) throw new Error('CREDENTIAL_LEASE_EXPIRED');

    const consumed = await this.leases.consume(lease.leaseId, binding, nowMs);
    if (!consumed) throw new Error('CREDENTIAL_LEASE_REPLAYED_OR_MISSING');
    assertBinding(consumed, binding);

    const secret = await this.secrets.resolve(consumed.credentialRef);
    if (!secret) throw new Error('CREDENTIAL_SECRET_EMPTY');
    return secret;
  }
}

/** @testOnly */
export class InMemoryCredentialLeaseStore implements CredentialLeaseStore {
  private readonly pending = new Map<string, CredentialLease>();

  async issue(lease: CredentialLease): Promise<void> {
    if (this.pending.has(lease.leaseId)) throw new Error('CREDENTIAL_LEASE_ID_COLLISION');
    this.pending.set(lease.leaseId, lease);
  }

  async consume(leaseId: string, binding: CredentialLeaseBinding, nowMs: number): Promise<CredentialLease | null> {
    const lease = this.pending.get(leaseId);
    if (!lease || lease.expiresAt <= nowMs) {
      this.pending.delete(leaseId);
      return null;
    }
    try {
      assertBinding(lease, binding);
    } catch {
      return null;
    }
    this.pending.delete(leaseId);
    return lease;
  }
}

function validateRequest(request: CredentialLeaseRequest): void {
  for (const [name, value] of Object.entries({ actorId: request.actorId, workerId: request.workerId, domain: request.domain, capability: request.capability, credentialRef: request.credentialRef })) {
    if (!value) throw new Error(`CREDENTIAL_LEASE_${name.toUpperCase()}_MISSING`);
  }
  if (request.ttlMs !== undefined && (!Number.isFinite(request.ttlMs) || request.ttlMs <= 0)) throw new Error('CREDENTIAL_LEASE_TTL_INVALID');
}

function assertBinding(lease: CredentialLease, binding: CredentialLeaseBinding): void {
  if (lease.actorId !== binding.actorId) throw new Error('CREDENTIAL_LEASE_ACTOR_MISMATCH');
  if (lease.workerId !== binding.workerId) throw new Error('CREDENTIAL_LEASE_WORKER_MISMATCH');
  if (lease.domain !== binding.domain) throw new Error('CREDENTIAL_LEASE_DOMAIN_MISMATCH');
  if (lease.capability !== binding.capability) throw new Error('CREDENTIAL_LEASE_CAPABILITY_MISMATCH');
  if (lease.credentialRef !== binding.credentialRef) throw new Error('CREDENTIAL_LEASE_REF_MISMATCH');
  if (lease.resourceId !== binding.resourceId) throw new Error('CREDENTIAL_LEASE_RESOURCE_MISMATCH');
}
