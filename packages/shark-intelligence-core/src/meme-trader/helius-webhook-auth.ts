/**
 * Helius webhook authHeader is delivered verbatim in the Authorization header.
 * Keep this helper transport-only: it grants no application authority.
 */
export function isHeliusWebhookAuthorizationValid(
  suppliedAuthorization: string | null | undefined,
  expectedAuthHeader: string | undefined,
): boolean {
  return typeof expectedAuthHeader === 'string'
    && expectedAuthHeader.length > 0
    && suppliedAuthorization === expectedAuthHeader
}
