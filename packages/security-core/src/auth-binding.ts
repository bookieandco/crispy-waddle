import type { SecurityRequest } from './index.js';

export type AuthenticatedPrincipal = {
  userId: string;
  sessionId: string;
};

export interface AuthVerifier {
  /** Must validate the access token with the trusted auth service. */
  verifyAccessToken(accessToken: string): Promise<AuthenticatedPrincipal | null>;
}

/**
 * Binds a caller-supplied request to the server-verified identity.
 * Never trust a client-supplied actorId/userId for authorization.
 */
export async function bindAuthenticatedPrincipal(
  verifier: AuthVerifier,
  accessToken: string,
  request: SecurityRequest,
): Promise<SecurityRequest | null> {
  if (!accessToken) return null;

  const principal = await verifier.verifyAccessToken(accessToken);
  if (!principal?.userId || !principal.sessionId) return null;

  if (request.actorId !== principal.userId) return null;

  return {
    ...request,
    actorId: principal.userId,
  };
}
