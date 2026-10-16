import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createRuntimeServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import {
  MemeStudioDraftRuntime,
  SupabaseMemeStudioDraftStore,
  listEligibleTokenVentures,
} from '@/lib/opportunities/meme-studio-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'cache-control': 'no-store' }
const MAX_BODY_SIZE = 32_000

function apiError(error: unknown, requestId: string) {
  const message = error instanceof Error ? error.message : 'MEME_STUDIO_UNKNOWN_ERROR'
  const status = /Authenticated|identity|session/i.test(message) ? 401 :
    message === 'MEME_STUDIO_REVISION_CONFLICT_OR_NOT_FOUND' ? 409 :
    message === 'MEME_STUDIO_ORIGIN_FORBIDDEN' ? 403 :
    message === 'MEME_STUDIO_STORAGE_UNAVAILABLE' || message.includes('SUPABASE_PROXY') ? 503 :
    message.startsWith('MEME_STUDIO_') || message.includes('must be') || message.includes('Token allocations') ||
      message.includes('Ticker') || message.includes('totalSupply') ? 400 : 502
  return NextResponse.json({
    ok: false,
    requestId,
    error: status === 401 ? 'Authentication required' :
      status === 502 ? 'MEME_STUDIO_REQUEST_FAILED' : message,
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  }, { status, headers })
}

function enforceOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  const expected = request.nextUrl.origin
  if (!origin || origin !== expected) throw new Error('MEME_STUDIO_ORIGIN_FORBIDDEN')
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new Error('MEME_STUDIO_JSON_REQUIRED')
  }
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  enforceOrigin(request)
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_SIZE) throw new Error('MEME_STUDIO_BODY_TOO_LARGE')
  const raw = await request.text()
  if (raw.length > MAX_BODY_SIZE) throw new Error('MEME_STUDIO_BODY_TOO_LARGE')
  let body: unknown
  try { body = JSON.parse(raw) } catch { throw new Error('MEME_STUDIO_INVALID_JSON') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('MEME_STUDIO_INVALID_JSON')
  return body as Record<string, unknown>
}

async function context() {
  // Always authenticate before allocating a service-role client or reading any rows.
  const identity = await requireRequestIdentity()
  const client = await createRuntimeServiceRoleClient()
  if (!client) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
  const ventures = new VentureRuntimeRepository(client)
  return {
    owner: identity.userId,
    ventures,
    drafts: new MemeStudioDraftRuntime(new SupabaseMemeStudioDraftStore(client), ventures),
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const ctx = await context()
    const draftId = request.nextUrl.searchParams.get('draftId')
    if (draftId) {
      const draft = await ctx.drafts.get(ctx.owner, draftId)
      return NextResponse.json({
        ok: true, requestId, draft,
        externalActionAuthorized: false, moneyMovementAuthorized: false,
      }, { status: draft ? 200 : 404, headers })
    }
    const [drafts, eligibleVentures] = await Promise.all([
      ctx.drafts.list(ctx.owner),
      listEligibleTokenVentures(ctx.owner, ctx.ventures),
    ])
    return NextResponse.json({
      ok: true, requestId, drafts, eligibleVentures,
      externalActionAuthorized: false,
      automaticExperimentAuthorized: false,
      moneyMovementAuthorized: false,
    }, { headers })
  } catch (error) { return apiError(error, requestId) }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const ctx = await context()
    const body = await readBody(request)
    if (Object.keys(body).some(k => !['payload', 'ventureId'].includes(k))) {
      throw new Error('MEME_STUDIO_UNEXPECTED_FIELDS')
    }
    const draft = await ctx.drafts.create(ctx.owner, { payload: body.payload, ventureId: body.ventureId })
    return NextResponse.json({
      ok: true, requestId, draft,
      externalActionAuthorized: false, moneyMovementAuthorized: false,
    }, { status: 201, headers })
  } catch (error) { return apiError(error, requestId) }
}

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const ctx = await context()
    const body = await readBody(request)
    if (Object.keys(body).some(k => !['id', 'revision', 'payload', 'ventureId'].includes(k)) ||
        typeof body.id !== 'string') throw new Error('MEME_STUDIO_UNEXPECTED_FIELDS')
    const draft = await ctx.drafts.update(ctx.owner, body.id, {
      payload: body.payload, revision: body.revision, ventureId: body.ventureId,
    })
    return NextResponse.json({
      ok: true, requestId, draft,
      externalActionAuthorized: false, moneyMovementAuthorized: false,
    }, { headers })
  } catch (error) { return apiError(error, requestId) }
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const ctx = await context()
    const body = await readBody(request)
    if (Object.keys(body).some(k => !['id', 'revision'].includes(k)) ||
        typeof body.id !== 'string') throw new Error('MEME_STUDIO_UNEXPECTED_FIELDS')
    const archived = await ctx.drafts.archive(ctx.owner, body.id, body.revision)
    return NextResponse.json({
      ok: true, requestId, ...archived,
      externalActionAuthorized: false, moneyMovementAuthorized: false,
    }, { headers })
  } catch (error) { return apiError(error, requestId) }
}
