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
const AWARD_PARAMS = new Set([
  'awardeeUniqueEntityId',
  'awardeeCageCode',
  'naicsCode',
  'productOrServiceCode',
  'contractingDepartmentName',
  'contractingSubtierName',
  'contractingOfficeCode',
  'approvedDate',
  'dateSigned',
  'typeOfSetAsideCode',
  'awardOrIDV',
  'includeSections',
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url: URL, requestKind: 'opportunity_search' | 'entity_search' | 'award_search') {
  let lastStatus = 0
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    lastStatus = response.status
    const payload = await response.json().catch(() => null)
    if (response.ok) {
      return { ok: true as const, status: response.status, payload }
    }

    const retryable = response.status === 408 || response.status === 429 || response.status >= 500
    if (!retryable || attempt === 3) break

    const retryAfter = Number(response.headers.get('retry-after') ?? '')
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 20_000)
      : Math.min(750 * (2 ** attempt), 6_000)
    await sleep(delay)
  }

  console.warn('[sam-upstream] upstream request failed', {
    requestKind,
    status: lastStatus,
  })
  return { ok: false as const, status: lastStatus, payload: null }
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
      contract: 'SAM_VERCEL_UPSTREAM.v2',
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

    const result = await fetchJson(url, 'opportunity_search')
    if (!result.ok) {
      return json({
        ok: false,
        error: 'sam_gov_request_failed',
        upstreamStatus: result.status,
      }, 502)
    }
    return json({ ok: true, data: result.payload })
  }

  if (action === 'awards') {
    const params = record(body.params)
    const url = new URL('https://api.sam.gov/contract-awards/v1/search')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set(
      'limit',
      String(Math.max(1, Math.min(Number(params.limit ?? 100) || 100, 100))),
    )
    url.searchParams.set(
      'offset',
      String(Math.max(0, Number(params.offset ?? 0) || 0)),
    )
    url.searchParams.set('awardOrIDV', 'Award')
    url.searchParams.set('includeSections', 'contractId,coreData,awardDetails')
    for (const [name, value] of Object.entries(params)) {
      if (AWARD_PARAMS.has(name) && typeof value === 'string' && value.trim()) {
        url.searchParams.set(name, value.trim())
      }
    }

    const result = await fetchJson(url, 'award_search')
    if (!result.ok) {
      return json({
        ok: false,
        error: 'sam_award_request_failed',
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

    const result = await fetchJson(url, 'entity_search')
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
