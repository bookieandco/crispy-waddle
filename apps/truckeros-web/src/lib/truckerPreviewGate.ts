/**
 * The legacy single-driver prototype has no customer/tenant authentication.
 * Never admit its APIs on a publicly deployed production Next app.
 * Only /api/health is allowed so a deployment can report its not-ready state.
 */
export function legacyApiBlocked(pathname: string, nodeEnv: string | undefined): boolean {
  return nodeEnv === "production" && pathname.startsWith("/api/") && pathname !== "/api/health"
}
