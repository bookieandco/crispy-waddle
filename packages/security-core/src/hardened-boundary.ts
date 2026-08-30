import type { SecurityDecision, SecurityPolicy, SecurityRequest } from './index.js';

export interface HardenedSecurityRequest<TPayload = unknown> {
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  resourceId?: string;
  payload: TPayload;
  payloadHash: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  requiresApproval?: boolean;
}

export interface ReplayGuard {
  has(nonce: string): Promise<boolean>;
  consume(nonce: string, expiresAt: number): Promise<boolean>;
}

export interface SecurityAuthorizer {
  authorize(request: SecurityRequest): SecurityDecision;
}

/** Test/local implementation only. Production deployments must use a durable, atomic store. */
export class InMemoryReplayGuard implements ReplayGuard {
  private readonly nonces = new Map<string, number>();

  async has(nonce: string): Promise<boolean> {
    this.prune();
    return this.nonces.has(nonce);
  }

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    this.prune();
    if (this.nonces.has(nonce)) return false;
    this.nonces.set(nonce, expiresAt);
    return true;
  }

  private prune(): void {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.nonces) {
      if (expiresAt <= now) this.nonces.delete(nonce);
    }
  }
}

const encoder = new TextEncoder();

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);
  return `{${entries.join(',')}}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashActionPayload(payload: unknown): Promise<string> {
  return sha256(canonicalize(payload));
}

export async function createHardenedRequest<TPayload>(input: {
  requestId: string;
  actorId: string;
  domain: string;
  capability: string;
  payload: TPayload;
  resourceId?: string;
  requiresApproval?: boolean;
  ttlMs?: number;
}): Promise<HardenedSecurityRequest<TPayload>> {
  const { ttlMs = 30_000, ...requestInput } = input;
  const issuedAt = Date.now();
  const expiresAt = issuedAt + Math.min(ttlMs, 60_000);
  return {
    ...requestInput,
    payloadHash: await hashActionPayload(input.payload),
    nonce: crypto.randomUUID(),
    issuedAt,
    expiresAt,
  };
}

export class HardenedSecurityBoundary {
  constructor(
    private readonly security: SecurityAuthorizer,
    private readonly replayGuard: ReplayGuard,
    private readonly maxClockSkewMs = 60_000,
  ) {}

  async authorize<TPayload>(request: HardenedSecurityRequest<TPayload>): Promise<SecurityDecision> {
    const now = Date.now();
    if (!request.requestId || !request.actorId || !request.domain || !request.capability || !request.nonce) return 'deny';
    if (!Number.isSafeInteger(request.issuedAt) || !Number.isSafeInteger(request.expiresAt)) return 'deny';
    if (request.issuedAt > now + this.maxClockSkewMs) return 'deny';
    if (request.expiresAt <= now || request.expiresAt - request.issuedAt > 60_000) return 'deny';
    if (await this.replayGuard.has(request.nonce)) return 'deny';

    const expectedHash = await hashActionPayload(request.payload);
    if (expectedHash !== request.payloadHash) return 'deny';

    // Consume only after all structural/integrity checks pass. The production
    // implementation must make this operation atomic across all Jhadina nodes.
    if (!(await this.replayGuard.consume(request.nonce, request.expiresAt))) return 'deny';

    return this.security.authorize({
      requestId: request.requestId,
      actorId: request.actorId,
      domain: request.domain,
      capability: request.capability,
      resourceId: request.resourceId,
      requiresApproval: request.requiresApproval,
      nonce: request.nonce,
      expiresAt: request.expiresAt,
    });
  }
}

export function createHardenedSecurityBoundary(
  security: SecurityAuthorizer,
  _policy: SecurityPolicy,
  replayGuard: ReplayGuard,
): HardenedSecurityBoundary {
  return new HardenedSecurityBoundary(security, replayGuard);
}
