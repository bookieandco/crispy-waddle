import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabasePublicConfig } from "./public-config"

const SERVICE_PROXY_FUNCTION = "jhadina-service-proxy"
const PRIVILEGED_PATH_PREFIXES = ["/rest/v1/", "/storage/v1/", "/auth/v1/"] as const
const TRANSIENT_PROXY_RETRY_DELAYS_MS = [250, 750, 1500] as const
const TRANSIENT_PROXY_STATUSES = new Set([408, 429, 502, 503, 504])
const RETRYABLE_PROXY_METHODS = new Set(["GET", "HEAD", "PUT", "PATCH", "DELETE"])

function resolveSupabaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    null
  )
}

function isPrivilegedSupabasePath(pathname: string): boolean {
  return PRIVILEGED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function createOidcSupabaseProxyFetch(
  supabaseUrl: string,
  oidcToken: string | (() => Promise<string>),
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
    headers.set("x-jhadina-target-path", `${target.pathname}${target.search}`)

    const method = request.method.toUpperCase()
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer()

    const callProxy = async (): Promise<Response> => {
      const currentToken = typeof oidcToken === "function" ? await oidcToken() : oidcToken
      if (!currentToken.trim()) throw new Error("JHADINA_SUPABASE_PROXY_OIDC_TOKEN_UNAVAILABLE")
      const attemptHeaders = new Headers(headers)
      attemptHeaders.set("authorization", `Bearer ${currentToken}`)
      return fetch(proxyUrl, {
        method,
        headers: attemptHeaders,
        body: body ? body.slice(0) : undefined,
        redirect: "manual",
      })
    }

    const retryable = RETRYABLE_PROXY_METHODS.has(method)
    let lastError: unknown
    for (let attempt = 0; attempt <= TRANSIENT_PROXY_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await callProxy()
        if (!retryable || !TRANSIENT_PROXY_STATUSES.has(response.status) || attempt === TRANSIENT_PROXY_RETRY_DELAYS_MS.length) {
          return response
        }
      } catch (error) {
        lastError = error
        if (!retryable || attempt === TRANSIENT_PROXY_RETRY_DELAYS_MS.length) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_PROXY_RETRY_DELAYS_MS[attempt]!))
    }
    throw lastError instanceof Error ? lastError : new Error("JHADINA_SUPABASE_PROXY_TRANSIENT_RETRY_EXHAUSTED")
  }
}

export function createVercelOidcSupabaseProxyFetch(
  supabaseUrl: string,
  oidcToken: string,
): typeof fetch {
  return createOidcSupabaseProxyFetch(supabaseUrl, oidcToken)
}

export function resolveServiceRoleConfig(): { url: string; key: string } | null {
  const url = resolveSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return { url, key }
}

/**
 * Privileged Supabase client. Direct service-role/secret configuration is the
 * preferred path. In Vercel production, when no long-lived Supabase secret is
 * present, the client can use Vercel's short-lived OIDC identity to call the
 * project-local `jhadina-service-proxy` Edge Function. That function verifies
 * the exact Vercel production project identity and applies Supabase's built-in
 * server secret inside Supabase, so the secret never has to live in Vercel.
 *
 * Both paths preserve the same privileged authority boundary. If neither
 * durable path is configured, this returns null and production callers fail
 * closed.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const direct = resolveServiceRoleConfig()
  if (direct) {
    return createClient(direct.url, direct.key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  let publicConfig:ReturnType<typeof getSupabasePublicConfig>
  try{publicConfig=getSupabasePublicConfig()}catch{return null}
  const url = publicConfig.url
  const publishableKey = publicConfig.publishableKey
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim()
  if (!oidcToken || process.env.VERCEL_ENV !== "production") return null

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: createVercelOidcSupabaseProxyFetch(url, oidcToken),
    },
  })
}


/**
 * Privileged client for protected GitHub scheduler workers.
 *
 * The route must authenticate the request with authorizedSchedulerRequest()
 * before calling this helper. The incoming GitHub OIDC token is then forwarded
 * only to the project-local service proxy, which independently verifies the
 * exact repository/workflow/ref/audience identity before applying Supabase
 * privileged credentials. This scheduler-specific bridge is gated by that
 * cryptographic identity rather than VERCEL_ENV; the generic Vercel OIDC
 * fallback remains production-only.
 */
export function createSchedulerServiceRoleClient(request: Request): SupabaseClient | null {
  const direct = resolveServiceRoleConfig()
  if (direct) {
    return createClient(direct.url, direct.key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  let publicConfig:ReturnType<typeof getSupabasePublicConfig>
  try{publicConfig=getSupabasePublicConfig()}catch{return null}
  const url = publicConfig.url
  const publishableKey = publicConfig.publishableKey
  const authorization = request.headers.get("authorization")
  const schedulerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""

  if (!schedulerToken) return null

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: createVercelOidcSupabaseProxyFetch(url, schedulerToken),
    },
  })
}
