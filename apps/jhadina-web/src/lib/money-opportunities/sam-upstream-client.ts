const DEFAULT_SAM_UPSTREAM_URL =
  'https://crispy-waddle-jhadina-web.vercel.app/api/internal/sam/upstream'

function endpoint() {
  return process.env.SAM_UPSTREAM_URL?.trim() || DEFAULT_SAM_UPSTREAM_URL
}

function token() {
  return process.env.SAM_UPSTREAM_OIDC_TOKEN?.trim()
}

async function request<T>(action: 'health' | 'search' | 'entities', params?: Record<string, unknown>) {
  const oidc = token()
  if (!oidc) throw new Error('SAM_UPSTREAM_OIDC_TOKEN is not configured')

  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${oidc}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ action, ...(params ? { params } : {}) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })

  const payload = await response.json().catch(() => ({
    ok: false,
    error: 'sam_upstream_invalid_json',
  })) as Record<string, unknown>

  if (!response.ok || payload.ok !== true) {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : `SAM upstream HTTP ${response.status}`,
    )
  }
  return payload as T
}

export function samUpstreamConfigured() {
  return Boolean(token())
}

export async function samUpstreamHealth() {
  return request<{
    ok: true
    samKeyConfigured: boolean
    contract: string
  }>('health')
}

export async function searchSamViaUpstream(params: Record<string, unknown>) {
  const payload = await request<{ ok: true; data: Record<string, unknown> }>('search', params)
  return payload.data
}

export async function searchSamEntitiesViaUpstream(params: Record<string, unknown>) {
  const payload = await request<{ ok: true; data: Record<string, unknown> }>('entities', params)
  return payload.data
}
