// Keep pre-existing PKCE email links working without a second auth boundary.
// Both /auth/callback and /auth/confirm use the same verified-owner checks.
export { GET, dynamic } from "../confirm/route";
