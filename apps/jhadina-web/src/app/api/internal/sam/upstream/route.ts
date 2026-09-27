import { NextRequest, NextResponse } from 'next/server'
import { authorizedGitHubWorkflowRequest } from '@/lib/internal-scheduler-auth'
import { getSamApiKey } from '@/lib/money-opportunities/sam-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const AUDIENCE = 'jhadina-sam-upstream'
const WORKFLOW_REF =
  'bookieandco/crispy-waddle/.github/workflows/sam-live-commissioning.yml@refs/heads/main'

const OPPORTUNITY_PARAMS = new Map([
  ['postedFrom', 'postedFrom'],
  ['postedTo', 'postedTo'],
  ['keyword', 'q'],
  ['noticeType', 'ptype'],
  ['typeOfSetAside', 'typeOfSetAside'],
  ['solicitationNumber', 'solnum'],
  ['noticeId', 'noticeid'],
  ['title', 'title'],
  ['state', 'state'],
  ['zip', 'zip'],
  ['naicsCode', 'ncode'],
  ['classificationCode', 'ccode'],
  ['organizationName', 'organizationName'],
])
const ENTITY_PARAMS = new Set([
  'naicsCode',
  'ueiSAM',
  'page',
  'size',
  'registrationStatus',
  'samRegistered',
  'purposeOfRegistrationCode',
  'includeSections',
  'sensitivity',
])

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function authorized(request: Request) {
  return authorizedGitHubWorkflowRequest(request, {
    audience: AUDIENCE,
    workflowRef: WORKFLOW_REF,
  })
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function fetchJson(url: URL) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      payload: null,
    }
  }
  return { ok: true as const, status: response.status, payload }
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return json({ ok: false }, 401)

  const apiKey = getSamApiKey()
  if (!apiKey) {
    return json({
      ok: false,
      error: 'sam_key_not_configured',
    }, 503)
  }

  const body = record(await request.json().catch(() => ({})))
  const action = typeof body.action === 'string' ? body.action : 'health'

  if (action === 'health') {
    return json({
      ok: true,
      samKeyConfigured: true,
      contract: 'SAM_VERCEL_UPSTREAM.v1',
    })
  }

  if (action === 'search') {
    const params = record(body.params)
    const url = new URL('https://api.sam.gov/opportunities/v2/search')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set(
      'limit',
      String(Math.max(1, Math.min(Number(params.limit ?? 25) || 25, 1000))),
    )
    url.searchParams.set(
      'offset',
      String(Math.max(0, Number(params.offset ?? 0) || 0)),
    )
    for (const [name, target] of OPPORTUNITY_PARAMS) {
      const value = params[name]
      if (typeof value === 'string' && value.trim()) {
        url.searchParams.set(target, value.trim())
      }
    }

    const result = await fetchJson(url)
    if (!result.ok) {
      return json({
        ok: false,
        error: 'sam_gov_request_failed',
        upstreamStatus: result.status,
      }, 502)
    }
    return json({ ok: true, data: result.payload })
  }

  if (action === 'entities') {
    const params = record(body.params)
    const url = new URL('https://api.sam.gov/entity-information/v3/entities')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('registrationStatus', 'A')
    url.searchParams.set('samRegistered', 'Yes')
    url.searchParams.set('purposeOfRegistrationCode', 'Z2')
    url.searchParams.set('includeSections', 'entityRegistration,coreData,assertions')
    url.searchParams.set('sensitivity', 'public')
    for (const [name, value] of Object.entries(params)) {
      if (ENTITY_PARAMS.has(name) && typeof value === 'string' && value.trim()) {
        url.searchParams.set(name, value.trim())
      }
    }

    const result = await fetchJson(url)
    if (!result.ok) {
      return json({
        ok: false,
        error: 'sam_entity_request_failed',
        upstreamStatus: result.status,
      }, 502)
    }
    return json({ ok: true, data: result.payload })
  }

  return json({ ok: false, error: 'unsupported_action' }, 400)
}
