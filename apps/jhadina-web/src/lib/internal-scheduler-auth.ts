import { timingSafeEqual } from 'node:crypto'

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com'
const GITHUB_OIDC_JWKS = 'https://token.actions.githubusercontent.com/.well-known/jwks'
const GITHUB_OIDC_AUDIENCE = 'jhadina-production-scheduler'
const GITHUB_REPOSITORY = 'bookieandco/crispy-waddle'
const GITHUB_MAIN_REF = 'refs/heads/main'
const GITHUB_WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/jhadina-production-scheduler.yml@refs/heads/main'

type JwtHeader = { alg?: string; kid?: string; typ?: string }
type SchedulerClaims = {
  aud?: string | string[]
  iss?: string
  sub?: string
  exp?: number
  nbf?: number
  repository?: string
  repository_owner?: string
  ref?: string
  event_name?: string
  workflow_ref?: string
}
type JsonWebKeyWithKid = JsonWebKey & { kid?: string; alg?: string; use?: string }

let cachedKeys: { expiresAt: number; keys: JsonWebKeyWithKid[] } | undefined

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function decodeBase64UrlJson<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T
}

function audienceMatches(aud: string | string[] | undefined): boolean {
  if (typeof aud === 'string') return aud === GITHUB_OIDC_AUDIENCE
  return Array.isArray(aud) && aud.includes(GITHUB_OIDC_AUDIENCE)
}

function claimsAreTrusted(claims: SchedulerClaims, nowSeconds: number): boolean {
  if (claims.iss !== GITHUB_OIDC_ISSUER) return false
  if (!audienceMatches(claims.aud)) return false
  if (claims.repository !== GITHUB_REPOSITORY) return false
  if (claims.repository_owner !== 'bookieandco') return false
  if (claims.ref !== GITHUB_MAIN_REF) return false
  if (claims.workflow_ref !== GITHUB_WORKFLOW_REF) return false
  if (!['schedule', 'workflow_dispatch'].includes(claims.event_name ?? '')) return false
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return false
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds + 30) return false
  if (typeof claims.sub !== 'string' || !claims.sub.startsWith(`repo:${GITHUB_REPOSITORY}:`)) return false
  return true
}

async function githubSigningKeys(fetchImpl: typeof fetch): Promise<JsonWebKeyWithKid[]> {
  const now = Date.now()
  if (cachedKeys && cachedKeys.expiresAt > now) return cachedKeys.keys

  const response = await fetchImpl(GITHUB_OIDC_JWKS, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`github_oidc_jwks_http_${response.status}`)

  const payload = (await response.json()) as { keys?: JsonWebKeyWithKid[] }
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('github_oidc_jwks_empty')
  }

  cachedKeys = { expiresAt: now + 5 * 60 * 1000, keys: payload.keys }
  return payload.keys
}

async function verifyGitHubOidc(
  token: string,
  fetchImpl: typeof fetch,
  nowSeconds: number,
): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  let header: JwtHeader
  let claims: SchedulerClaims
  try {
    header = decodeBase64UrlJson<JwtHeader>(parts[0]!)
    claims = decodeBase64UrlJson<SchedulerClaims>(parts[1]!)
  } catch {
    return false
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return false
  if (!claimsAreTrusted(claims, nowSeconds)) return false

  try {
    const jwk = (await githubSigningKeys(fetchImpl)).find((candidate) => candidate.kid === header.kid)
    if (!jwk) return false
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      Buffer.from(parts[2]!, 'base64url'),
      Buffer.from(`${parts[0]}.${parts[1]}`),
    )
  } catch {
    return false
  }
}

/**
 * Authorizes production scheduler traffic using either the existing shared
 * CRON_SECRET or a signature-verified GitHub Actions OIDC token issued only
 * to the exact main-branch production scheduler workflow.
 */
export async function authorizedSchedulerRequest(
  request: Request,
  options: { fetchImpl?: typeof fetch; nowSeconds?: number } = {},
): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return false

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (cronSecret && constantTimeEqual(token, cronSecret)) return true

  return verifyGitHubOidc(
    token,
    options.fetchImpl ?? fetch,
    options.nowSeconds ?? Math.floor(Date.now() / 1000),
  )
}
