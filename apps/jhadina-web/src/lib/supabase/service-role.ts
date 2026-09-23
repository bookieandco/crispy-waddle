import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SERVICE_PROXY_FUNCTION = "jhadina-service-proxy"
const PRIVILEGED_PATH_PREFIXES = ["/rest/v1/", "/storage/v1/", "/auth/v1/"] as const

function isPrivilegedSupabasePath(pathname: string): boolean {
  return PRIVILEGED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function createVercelOidcSupabaseProxyFetch(
  supabaseUrl: string,
  oidcToken: string,
): typeof fetch {
  const origin = new URL(supabaseUrl).origin
  const proxyUrl = new URL(`/functions/v1/${SERVICE_PROXY_FUNCTION}`, origin).toString()

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init)
    const target = new URL(request.url)

    if (target.origin !== origin || !isPrivilegedSupabasePath(target.pathname)) {
      throw new Error("JHADINA_SUPABASE_PROXY_TARGET_FORBIDDEN")
    }

    const headers = new Headers(request.headers)
    for (const name of [
      "authorization",
      "apikey",
      "host",
      "content-length",
      "x-jhadina-target-path",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-proto",
    ]) {
      headers.delete(name)
    }
    headers.set("authorization", `Bearer ${oidcToken}`)
    headers.set("x-jhadina-target-path", `${target.pathname}${target.search}`)

    const method = request.method.toUpperCase()
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer()

    return fetch(proxyUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    })
  }
}

/**
 * Privileged Supabase client. Direct service-role/secret configuration is the
 * preferred path. In Vercel production, when no long-lived Supabase secret is
 * present, the client can use Vercel's short-lived OIDC identity to call the
 * project-local `jhadina-service-proxy` Edge Function. That function verifies
 * the exact Vercel production project identity and applies Supabase's built-in
 * server secret inside Supabase, so the secret never has to live in Vercel.
 *
 * Both paths preserve the same privileged authority boundary: callers receive
 * a server-only client capable of PostgREST/RPC/Auth/Storage operations. If
 * neither durable path is configured, this returns null and production callers
 * continue to fail closed.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null

  const directKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (directKey) {
    return createClient(url, directKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const oidcToken = process.env.VERCEL_OIDC_TOKEN
  if (!publishableKey || !oidcToken || process.env.VERCEL_ENV !== "production") {
    return null
  }

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: createVercelOidcSupabaseProxyFetch(url, oidcToken),
    },
  })
}
