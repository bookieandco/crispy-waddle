import type { CredentialGrant } from './credential-broker.js';
import type { CredentialLeaseStore, CredentialLeaseUseRequest } from './credential-lease-store.js';
export interface CredentialLeaseRpcClient { rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>; }
export class RpcCredentialLeaseStore implements CredentialLeaseStore {
  constructor(private readonly client: CredentialLeaseRpcClient) {}
  async create(grant: CredentialGrant): Promise<void> {
    const { error } = await this.client.rpc('create_jhadina_credential_lease', {
      p_lease_id: grant.leaseId, p_actor_id: grant.actorId, p_worker_id: grant.workerId ?? null, p_capability: grant.capability,
      p_provider: grant.provider, p_credential_ref: grant.credentialRef, p_purpose: grant.purpose, p_resource_id: grant.resourceId ?? null,
      p_expires_at: new Date(grant.expiresAt).toISOString(), p_max_uses: grant.maxUses,
      p_egress_destination: grant.egressDestination ?? null, p_egress_policy_version: grant.egressPolicyVersion ?? null,
      p_egress_decision_reason: grant.egressDecisionReason ?? null,
    });
    if (error) throw new Error('CREDENTIAL_LEASE_CREATE_FAILED');
  }
  async consume(leaseId: string, request: CredentialLeaseUseRequest, now: number): Promise<boolean> {
    const { data, error } = await this.client.rpc<boolean>('consume_jhadina_credential_lease', {
      p_lease_id: leaseId, p_actor_id: request.actorId, p_worker_id: request.workerId ?? null, p_capability: request.capability,
      p_provider: request.provider, p_credential_ref: request.credentialRef, p_purpose: request.purpose, p_resource_id: request.resourceId ?? null,
      p_now: new Date(now).toISOString(), p_egress_destination: request.egressDestination ?? null,
      p_egress_policy_version: request.egressPolicyVersion ?? null, p_egress_decision_reason: request.egressDecisionReason ?? null,
    });
    if (error) throw new Error('CREDENTIAL_LEASE_CONSUME_FAILED');
    return data === true;
  }
}
