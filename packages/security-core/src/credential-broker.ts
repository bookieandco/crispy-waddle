export type CredentialTrust = 'untrusted' | 'quarantined' | 'trusted-compute';

export type CredentialRequest = {
  requestId: string;
  actorId: string;
  workerId?: string;
  workerTrust?: CredentialTrust;
  capability: string;
  provider: string;
  credentialRef: string;
  purpose: string;
  resourceId?: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type CredentialGrant = {
  leaseId: string;
  actorId: string;
  workerId?: string;
  capability: string;
  provider: string;
  credentialRef: string;
  purpose: string;
  resourceId?: string;
  issuedAt: number;
  expiresAt: number;
  maxUses: number;
};

export type CredentialMaterial = {
  secret: string;
  expiresAt?: number;
};

export interface CredentialStore {
  resolve(credentialRef: string): Promise<CredentialMaterial | null>;
}

export type CredentialPolicy = {
  maxTtlMs: number;
  providerCapabilities: Readonly<Record<string, readonly string[]>>;
  allowedCredentialRefs: readonly string[];
  maxUses: number;
};

export class CredentialBrokerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'CredentialBrokerError';
  }
}

export class CredentialBroker {
  private readonly usedLeases = new Map<string, number>();

  constructor(
    private readonly store: CredentialStore,
    private readonly policy: CredentialPolicy,
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = () => crypto.randomUUID(),
  ) {}

  async issue(request: CredentialRequest): Promise<CredentialGrant> {
    const now = this.now();
    if (!request.requestId || !request.actorId || !request.nonce) throw new CredentialBrokerError('INVALID_IDENTITY');
    if (!request.purpose.trim()) throw new CredentialBrokerError('PURPOSE_REQUIRED');
    if (request.expiresAt <= now) throw new CredentialBrokerError('REQUEST_EXPIRED');
    if (request.expiresAt - now > this.policy.maxTtlMs) throw new CredentialBrokerError('TTL_EXCEEDED');
    if (!this.policy.allowedCredentialRefs.includes(request.credentialRef)) throw new CredentialBrokerError('CREDENTIAL_REF_DENIED');
    if (!(this.policy.providerCapabilities[request.provider] ?? []).includes(request.capability)) throw new CredentialBrokerError('CAPABILITY_PROVIDER_MISMATCH');
    if (request.workerTrust !== undefined && request.workerTrust !== 'trusted-compute') throw new CredentialBrokerError('WORKER_NOT_TRUSTED');
    if (request.workerId === undefined && request.workerTrust !== undefined) throw new CredentialBrokerError('WORKER_BINDING_REQUIRED');

    const material = await this.store.resolve(request.credentialRef);
    if (!material?.secret) throw new CredentialBrokerError('CREDENTIAL_NOT_AVAILABLE');
    if (material.expiresAt !== undefined && material.expiresAt <= now) throw new CredentialBrokerError('CREDENTIAL_EXPIRED');

    const leaseId = this.idFactory();
    this.usedLeases.set(leaseId, 0);
    return {
      leaseId,
      actorId: request.actorId,
      workerId: request.workerId,
      capability: request.capability,
      provider: request.provider,
      credentialRef: request.credentialRef,
      purpose: request.purpose,
      resourceId: request.resourceId,
      issuedAt: now,
      expiresAt: Math.min(request.expiresAt, now + this.policy.maxTtlMs, material.expiresAt ?? Number.MAX_SAFE_INTEGER),
      maxUses: this.policy.maxUses,
    };
  }

  async use(grant: CredentialGrant, request: Pick<CredentialRequest, 'actorId' | 'workerId' | 'capability' | 'provider' | 'credentialRef' | 'purpose' | 'resourceId'>): Promise<CredentialMaterial> {
    const now = this.now();
    if (grant.expiresAt <= now) throw new CredentialBrokerError('GRANT_EXPIRED');
    if (grant.actorId !== request.actorId) throw new CredentialBrokerError('ACTOR_MISMATCH');
    if (grant.workerId !== request.workerId) throw new CredentialBrokerError('WORKER_MISMATCH');
    if (grant.capability !== request.capability || grant.provider !== request.provider) throw new CredentialBrokerError('GRANT_SCOPE_MISMATCH');
    if (grant.credentialRef !== request.credentialRef) throw new CredentialBrokerError('CREDENTIAL_REF_MISMATCH');
    if (grant.purpose !== request.purpose) throw new CredentialBrokerError('PURPOSE_MISMATCH');
    if (grant.resourceId !== request.resourceId) throw new CredentialBrokerError('RESOURCE_MISMATCH');
    const uses = this.usedLeases.get(grant.leaseId);
    if (uses === undefined) throw new CredentialBrokerError('UNKNOWN_LEASE');
    if (uses >= grant.maxUses) throw new CredentialBrokerError('LEASE_EXHAUSTED');
    const material = await this.store.resolve(grant.credentialRef);
    if (!material?.secret) throw new CredentialBrokerError('CREDENTIAL_NOT_AVAILABLE');
    if (material.expiresAt !== undefined && material.expiresAt <= now) throw new CredentialBrokerError('CREDENTIAL_EXPIRED');
    this.usedLeases.set(grant.leaseId, uses + 1);
    return { secret: material.secret, expiresAt: material.expiresAt };
  }
}

/** Test-only store. Production implementations must keep secret material server-side. */
export class InMemoryCredentialStore implements CredentialStore {
  constructor(private readonly values: Readonly<Record<string, CredentialMaterial>>) {}
  async resolve(credentialRef: string): Promise<CredentialMaterial | null> {
    return this.values[credentialRef] ?? null;
  }
}

export function credentialGrantSafeAudit(grant: CredentialGrant): Omit<CredentialGrant, 'credentialRef'> & { credentialRef: '[REDACTED]' } {
  const { credentialRef: _credentialRef, ...safe } = grant;
  return { ...safe, credentialRef: '[REDACTED]' };
}
