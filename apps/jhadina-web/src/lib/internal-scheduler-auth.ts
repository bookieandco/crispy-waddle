import { timingSafeEqual } from 'node:crypto'

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com'
const GITHUB_OIDC_JWKS = 'https://token.actions.githubusercontent.com/.well-known/jwks'
const GITHUB_REPOSITORY = 'bookieandco/crispy-waddle'
const GITHUB_REPOSITORY_ID = '1320251374'
const GITHUB_REPOSITORY_OWNER = 'bookieandco'
const GITHUB_REPOSITORY_OWNER_ID = '289295074'
const GITHUB_MAIN_REF = 'refs/heads/main'
const GITHUB_IMMUTABLE_SUBJECT =
  'repo:bookieandco@289295074/crispy-waddle@1320251374:ref:refs/heads/main'

const SCHEDULER_AUDIENCE = 'jhadina-production-scheduler'
const SCHEDULER_WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/jhadina-production-scheduler.yml@refs/heads/main'

type JwtHeader = { alg?: string; kid?: string; typ?: string }
type SchedulerClaims = {
  aud?: string | string[]
  iss?: string
  sub?: string
  exp?: number
  nbf?: number
  repository?: string
  repository_id?: string
  repository_owner?: string
  repository_owner_id?: string
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

function audienceMatches(aud: string | string[] | undefined, expected: string): boolean {
  if (typeof aud === 'string') return aud === expected
  return Array.isArray(aud) && aud.includes(expected)
}

export interface GitHubWorkflowIdentity {
  audience: string
  workflowRef: string
  repository: string
  repositoryId: string
  repositoryOwner: string
  repositoryOwnerId: string
  ref: string
  subject?: string
  allowedEvents?: readonly string[]
}

function claimsAreTrusted(
  claims: SchedulerClaims,
  nowSeconds: number,
  identity: GitHubWorkflowIdentity,
): boolean {
  if (claims.iss !== GITHUB_OIDC_ISSUER) return false
  if (!audienceMatches(claims.aud, identity.audience)) return false
  if (claims.repository !== identity.repository) return false
  if (claims.repository_id !== identity.repositoryId) return false
  if (claims.repository_owner !== identity.repositoryOwner) return false
  if (claims.repository_owner_id !== identity.repositoryOwnerId) return false
  if (claims.ref !== identity.ref) return false
  if (claims.workflow_ref !== identity.workflowRef) return false
  if (!(identity.allowedEvents ?? ['schedule', 'workflow_dispatch', 'push']).includes(claims.event_name ?? '')) return false
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return false
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds + 30) return false
  if (identity.subject && claims.sub !== identity.subject) return false
  return true
}

async function githubSigningKeys(
  fetchImpl: typeof fetch,
  forceRefresh = false,
): Promise<JsonWebKeyWithKid[]> {
  const now = Date.now()
  if (!forceRefresh && cachedKeys && cachedKeys.expiresAt > now) return cachedKeys.keys

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
  identity: GitHubWorkflowIdentity,
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
  if (!claimsAreTrusted(claims, nowSeconds, identity)) return false

  try {
    let jwk = (await githubSigningKeys(fetchImpl)).find((candidate) => candidate.kid === header.kid)
    if (!jwk) {
      jwk = (await githubSigningKeys(fetchImpl, true)).find((candidate) => candidate.kid === header.kid)
    }
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

export async function authorizedGitHubRepositoryWorkflowRequest(
  request: Request,
  input: GitHubWorkflowIdentity & {
    fetchImpl?: typeof fetch
    nowSeconds?: number
  },
): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return false

  return verifyGitHubOidc(
    token,
    input.fetchImpl ?? fetch,
    input.nowSeconds ?? Math.floor(Date.now() / 1000),
    input,
  )
}

export async function authorizedGitHubWorkflowRequest(
  request: Request,
  input: {
    audience: string
    workflowRef: string
    fetchImpl?: typeof fetch
    nowSeconds?: number
  },
): Promise<boolean> {
  return authorizedGitHubRepositoryWorkflowRequest(request, {
    audience: input.audience,
    workflowRef: input.workflowRef,
    repository: GITHUB_REPOSITORY,
    repositoryId: GITHUB_REPOSITORY_ID,
    repositoryOwner: GITHUB_REPOSITORY_OWNER,
    repositoryOwnerId: GITHUB_REPOSITORY_OWNER_ID,
    ref: GITHUB_MAIN_REF,
    subject: GITHUB_IMMUTABLE_SUBJECT,
    fetchImpl: input.fetchImpl,
    nowSeconds: input.nowSeconds,
  })
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

  return authorizedGitHubWorkflowRequest(request, {
    audience: SCHEDULER_AUDIENCE,
    workflowRef: SCHEDULER_WORKFLOW_REF,
    ...options,
  })
}


const DIRECTOR_BACKGROUND_AUDIENCE = 'jhadina-director-background'
const DIRECTOR_BACKGROUND_WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/director-background-supervisor.yml@refs/heads/main'

/**
 * Authorizes only the Director background supervisor on main. This keeps
 * Director production/watch availability independent from unrelated global
 * scheduler health while preserving exact GitHub OIDC workflow identity.
 */
export async function authorizedDirectorBackgroundRequest(
  request:Request,
  options:{fetchImpl?:typeof fetch;nowSeconds?:number}={},
):Promise<boolean>{
  return authorizedGitHubWorkflowRequest(request,{
    audience:DIRECTOR_BACKGROUND_AUDIENCE,
    workflowRef:DIRECTOR_BACKGROUND_WORKFLOW_REF,
    ...options,
  })
}
