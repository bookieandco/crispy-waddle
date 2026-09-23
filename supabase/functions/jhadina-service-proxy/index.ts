import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0"

const TEAM_SLUG = "bookieandcos-projects"
const TEAM_ID = "team_NYQJ3NwijZZ6UJQdOdc5FjmX"
const PROJECT_NAME = "crispy-waddle-jhadina-web"
const PROJECT_ID = "prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco"
const ENVIRONMENT = "production"

const TEAM_ISSUER = `https://oidc.vercel.com/${TEAM_SLUG}`
const GLOBAL_ISSUER = "https://oidc.vercel.com"
const AUDIENCE = `https://vercel.com/${TEAM_SLUG}`
const SUBJECT =
  `owner:${TEAM_SLUG}:project:${PROJECT_NAME}:environment:${ENVIRONMENT}`

const JWKS = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
)

const ALLOWED_PREFIXES = ["/rest/v1/", "/storage/v1/", "/auth/v1/"] as const
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 })
}

async function verifyVercelIdentity(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return false
  const token = authorization.slice("Bearer ".length).trim()
  if (!token) return false

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: AUDIENCE,
      subject: SUBJECT,
    })

    if (payload.iss !== TEAM_ISSUER && payload.iss !== GLOBAL_ISSUER) return false
    if (payload.owner_id !== TEAM_ID) return false
    if (payload.project_id !== PROJECT_ID) return false
    if (payload.project !== PROJECT_NAME) return false
    if (payload.environment !== ENVIRONMENT) return false
    return true
  } catch {
    return false
  }
}

function privilegedKey(): { value: string; legacy: boolean } | null {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (modern) {
    try {
      const parsed = JSON.parse(modern) as Record<string, unknown>
      const value = parsed.default
      if (typeof value === "string" && value.trim()) {
        return { value: value.trim(), legacy: false }
      }
    } catch {
      // Fall through to the hosted legacy service-role variable.
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
  return legacy ? { value: legacy, legacy: true } : null
}

function allowedTarget(path: string): boolean {
  if (!path.startsWith("/")) return false
  if (path.includes("\\") || path.includes("\u0000")) return false

  let parsed: URL
  try {
    parsed = new URL(path, "https://supabase.invalid")
  } catch {
    return false
  }

  return ALLOWED_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
}

Deno.serve(async (request: Request) => {
  if (!(await verifyVercelIdentity(request))) return unauthorized()

  const method = request.method.toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    return Response.json({ error: "method_not_allowed" }, { status: 405 })
  }

  const targetPath = request.headers.get("x-jhadina-target-path")?.trim() ?? ""
  if (!allowedTarget(targetPath)) {
    return Response.json({ error: "target_forbidden" }, { status: 403 })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim()
  const key = privilegedKey()
  if (!supabaseUrl || !key) {
    return Response.json({ error: "privileged_supabase_key_unavailable" }, { status: 503 })
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
  headers.set("apikey", key.value)
  if (key.legacy) headers.set("authorization", `Bearer ${key.value}`)

  const upstream = await fetch(new URL(targetPath, supabaseUrl), {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  })

  const responseHeaders = new Headers(upstream.headers)
  for (const name of ["connection", "keep-alive", "transfer-encoding"]) {
    responseHeaders.delete(name)
  }
  responseHeaders.set("x-jhadina-privileged-transport", "vercel-oidc")

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
})
