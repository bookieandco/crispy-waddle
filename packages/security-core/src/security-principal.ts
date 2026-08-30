export type PrincipalType = 'owner' | 'device' | 'worker' | 'service';

export type SecurityPrincipal = {
  principalId: string;
  type: PrincipalType;
  subjectId: string;
  deviceId?: string;
  sessionId?: string;
  authenticatedAt: number;
  expiresAt: number;
  authenticationMethod: 'passkey' | 'device_key' | 'workload_identity';
};

export type PrincipalBinding = {
  actorId: string;
  principalId: string;
  deviceId: string;
  sessionId: string;
  expiresAt: number;
};

export function isPrincipalFresh(principal: SecurityPrincipal, now = Date.now()): boolean {
  return Boolean(principal.principalId && principal.subjectId)
    && principal.expiresAt > now
    && principal.authenticatedAt <= now;
}

export function bindPrincipalToRequest(
  principal: SecurityPrincipal,
  binding: PrincipalBinding,
  now = Date.now(),
): boolean {
  return isPrincipalFresh(principal, now)
    && principal.principalId === binding.principalId
    && principal.deviceId === binding.deviceId
    && principal.sessionId === binding.sessionId
    && binding.expiresAt > now
    && binding.actorId === principal.subjectId;
}

/**
 * Deliberately does not parse or validate bearer tokens. Token verification
 * belongs at the authenticated gateway using the configured identity provider.
 * Security Core consumes the resulting verified principal only.
 */
export interface PrincipalVerifier {
  verifyCredential(credential: unknown): Promise<SecurityPrincipal | null>;
}
