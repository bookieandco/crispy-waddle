import { headers } from "next/headers";

/**
 * Resolve Vercel's short-lived project OIDC token without depending on a
 * manually copied environment variable.
 *
 * Vercel may expose the token through the request context header or through the
 * VERCEL_OIDC_TOKEN system variable. Keep the environment fallback for tests,
 * local development and older runtimes.
 */
export function currentVercelOidcToken(): string {
  const envToken=process.env.VERCEL_OIDC_TOKEN?.trim();
  if(envToken) return envToken;

  try{
    return headers().get("x-vercel-oidc-token")?.trim() ?? "";
  }catch{
    return "";
  }
}
