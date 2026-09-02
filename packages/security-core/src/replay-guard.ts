import type { SecurityRequest } from './index.js';

/**
 * Durable-capable nonce replay boundary for Security Core.
 * `consume` must be atomic: true means this request owns the nonce; false
 * means it was already consumed or is otherwise invalid for replay protection.
 */
export interface NonceReplayGuard {
  consume(request: Pick<SecurityRequest, 'nonce' | 'requestId' | 'actorId' | 'expiresAt'>): Promise<boolean>;
}

/** Test-only/process-local implementation. Production callers must inject a durable guard. */
export class InMemoryNonceReplayGuard implements NonceReplayGuard {
  private readonly consumed = new Set<string>();

  async consume(request: Pick<SecurityRequest, 'nonce' | 'requestId' | 'actorId' | 'expiresAt'>): Promise<boolean> {
    if (!request.nonce || !request.requestId || !request.actorId || request.expiresAt <= Date.now()) return false;
    if (this.consumed.has(request.nonce)) return false;
    this.consumed.add(request.nonce);
    return true;
  }
}
