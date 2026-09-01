import type { CredentialGrant, CredentialRequest } from './credential-broker.js';

export type CredentialLeaseUseRequest = Pick<CredentialRequest, 'actorId' | 'workerId' | 'capability' | 'provider' | 'credentialRef' | 'purpose' | 'resourceId' | 'egressDestination' | 'egressPolicyVersion' | 'egressDecisionReason'>;

export interface CredentialLeaseStore {
  create(grant: CredentialGrant): Promise<void>;
  /** Atomically consume one use only when the persisted lease scope and egress binding match. */
  consume(leaseId: string, request: CredentialLeaseUseRequest, now: number): Promise<boolean>;
}

export class InMemoryCredentialLeaseStore implements CredentialLeaseStore {
  private readonly leases = new Map<string, { grant: CredentialGrant; uses: number }>();
  async create(grant: CredentialGrant): Promise<void> {
    if (this.leases.has(grant.leaseId)) throw new Error('CREDENTIAL_LEASE_EXISTS');
    this.leases.set(grant.leaseId, { grant, uses: 0 });
  }
  async consume(leaseId: string, request: CredentialLeaseUseRequest, now: number): Promise<boolean> {
    const entry = this.leases.get(leaseId);
    if (!entry || entry.grant.expiresAt <= now || entry.uses >= entry.grant.maxUses) return false;
    const { grant } = entry;
    if (grant.actorId !== request.actorId || grant.workerId !== request.workerId || grant.capability !== request.capability
      || grant.provider !== request.provider || grant.credentialRef !== request.credentialRef || grant.purpose !== request.purpose
      || grant.resourceId !== request.resourceId || grant.egressDestination !== request.egressDestination
      || grant.egressPolicyVersion !== request.egressPolicyVersion || grant.egressDecisionReason !== request.egressDecisionReason) return false;
    entry.uses += 1;
    return true;
  }
}

export interface CredentialLeaseSqlExecutor { query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>; }

export class PostgresCredentialLeaseStore implements CredentialLeaseStore {
  constructor(private readonly db: CredentialLeaseSqlExecutor) {}
  async create(grant: CredentialGrant): Promise<void> {
    await this.db.query(`select public.create_jhadina_credential_lease($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
      grant.leaseId, grant.actorId, grant.workerId ?? null, grant.capability, grant.provider, grant.credentialRef,
      grant.purpose, grant.resourceId ?? null, new Date(grant.expiresAt), grant.maxUses,
      grant.egressDestination ?? null, grant.egressPolicyVersion ?? null, grant.egressDecisionReason ?? null,
    ]);
  }
  async consume(leaseId: string, request: CredentialLeaseUseRequest, now: number): Promise<boolean> {
    const rows = await this.db.query<{ accepted: boolean }>(`select public.consume_jhadina_credential_lease($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as accepted`, [
      leaseId, request.actorId, request.workerId ?? null, request.capability, request.provider, request.credentialRef,
      request.purpose, request.resourceId ?? null, new Date(now), request.egressDestination ?? null,
      request.egressPolicyVersion ?? null, request.egressDecisionReason ?? null, null,
    ]);
    return rows[0]?.accepted === true;
  }
}
