import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Resolve Vercel's short-lived project OIDC token through the supported helper.
 *
 * The helper reads the request context in production and refreshes the token
 * when needed. Failure is fail-closed so static worker tokens may remain an
 * explicit fallback in the calling runtime.
 */
export async function currentVercelOidcToken(): Promise<string> {
  try {
    return (await getVercelOidcToken()).trim();
  } catch {
    return "";
  }
}
