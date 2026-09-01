import type { NonceReplayGuard, SecurityRequest } from '@jhadina/security-core';
import type { AuditRpcClient } from './supabase-audit-ledger.js';

/** Durable nonce replay guard backed by an atomic Postgres claim RPC. */
export class SupabaseNonceReplayGuard implements NonceReplayGuard {
  constructor(private readonly client: AuditRpcClient) {}

  async consume(request: Pick<SecurityRequest, 'nonce' | 'requestId' | 'actorId' | 'expiresAt'>): Promise<boolean> {
    const { data, error } = await this.client.rpc<boolean>('consume_jhadina_security_nonce', {
      p_nonce: request.nonce,
      p_request_id: request.requestId,
      p_actor_id: request.actorId,
      p_expires_at: new Date(request.expiresAt).toISOString(),
    });
    if (error) throw new Error(`DURABLE_NONCE_REPLAY_GUARD_FAILED:${error.message}`);
    return data === true;
  }
}
