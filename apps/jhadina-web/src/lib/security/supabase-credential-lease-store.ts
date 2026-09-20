import type { CredentialLease, CredentialLeaseBinding, CredentialLeaseStore } from "@jhadina/security-core"

type RpcClient = {
  rpc<T = unknown>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>
}

/**
 * Production adapter for CredentialLeaseStore.
 *
 * The database owns replay protection: consume_jhadina_credential_lease
 * atomically deletes the matching lease and returns it only once. This class
 * deliberately has no secret field and never persists credential material.
 */
export class SupabaseCredentialLeaseStore implements CredentialLeaseStore {
  constructor(private readonly client: RpcClient) {}

  async issue(lease: CredentialLease): Promise<void> {
    const { error } = await this.client.rpc("issue_jhadina_credential_lease", {
      p_lease_id: lease.leaseId,
      p_actor_id: lease.actorId,
      p_worker_id: lease.workerId,
      p_domain: lease.domain,
      p_capability: lease.capability,
      p_credential_ref: lease.credentialRef,
      p_resource_id: lease.resourceId ?? null,
      p_issued_at: new Date(lease.issuedAt).toISOString(),
      p_expires_at: new Date(lease.expiresAt).toISOString(),
    })
    if (error) throw new Error(`CREDENTIAL_LEASE_ISSUE_FAILED:${error.message}`)
  }

  async consume(leaseId: string, binding: CredentialLeaseBinding, nowMs: number): Promise<CredentialLease | null> {
    const { data, error } = await this.client.rpc<{
      lease_id: string
      actor_id: string
      worker_id: string
      domain: string
      capability: string
      credential_ref: string
      resource_id: string | null
      issued_at: string
      expires_at: string
    } | null>("consume_jhadina_credential_lease", {
      p_lease_id: leaseId,
      p_actor_id: binding.actorId,
      p_worker_id: binding.workerId,
      p_domain: binding.domain,
      p_capability: binding.capability,
      p_credential_ref: binding.credentialRef,
      p_resource_id: binding.resourceId ?? null,
      p_now: new Date(nowMs).toISOString(),
    })
    if (error) throw new Error(`CREDENTIAL_LEASE_CONSUME_FAILED:${error.message}`)
    if (!data) return null
    return {
      leaseId: data.lease_id,
      actorId: data.actor_id,
      workerId: data.worker_id,
      domain: data.domain,
      capability: data.capability,
      credentialRef: data.credential_ref,
      ...(data.resource_id ? { resourceId: data.resource_id } : {}),
      issuedAt: Date.parse(data.issued_at),
      expiresAt: Date.parse(data.expires_at),
    }
  }
}
