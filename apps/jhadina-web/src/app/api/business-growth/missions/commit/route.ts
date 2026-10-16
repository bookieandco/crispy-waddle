import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { buildBusinessGrowthMissionDeck, type BusinessGrowthSnapshot } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Opt-in persistence for analysis-only missions into the EXISTING Venture ledger.
 * Never dispatches an agent, publishes content, authorizes outreach, or spends.
 * Preserves all existing work-item states (including completed/running).
 */
export async function POST(request: Request) {
  let ownerUserId: string
  try {
    ownerUserId = (await requireRequestIdentity()).userId
  } catch {
    return NextResponse.json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
  }
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 65_536) {
      return NextResponse.json({ ok: false, error: 'MISSION_INPUT_TOO_LARGE' }, { status: 413 })
    }
    const supplied = await request.json() as BusinessGrowthSnapshot
    if (!supplied || !Array.isArray(supplied.evidence) || !Array.isArray(supplied.signals)
      || supplied.signals.length > 25 || supplied.evidence.length > 50
      || typeof supplied.ventureId !== 'string' || !supplied.ventureId.trim()) {
      return NextResponse.json({ ok: false, error: 'MISSION_INPUT_INVALID' }, { status: 400 })
    }
    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ ok: false, error: 'VENTURE_RUNTIME_UNAVAILABLE' }, { status: 503 })
    const repository = new VentureRuntimeRepository(service)
    // Service role is server-only. Explicit owner predicate prevents cross-tenant writes.
    const venture = await repository.getVenture(ownerUserId, supplied.ventureId.trim())
    if (!venture) return NextResponse.json({ ok: false, error: 'OWNED_VENTURE_NOT_FOUND' }, { status: 404 })
    if (['killed', 'archived', 'paused'].includes(venture.lifecycle)) {
      return NextResponse.json({ ok: false, error: 'VENTURE_NOT_ACTIVE' }, { status: 409 })
    }
    const now = new Date().toISOString()
    const input: BusinessGrowthSnapshot = {
      ventureId: venture.id,
      businessId: venture.id,
      siteUrl: supplied.siteUrl,
      observedAt: now,
      evidence: supplied.evidence.map(item => ({ ...item, kind: 'manual' as const, verified: false, observedAt: now })),
      signals: supplied.signals.map(signal => ({
        ...signal,
        id: 'query-' + createHash('sha256')
          .update([String(signal.query).trim().toLowerCase(), signal.issue ?? '', signal.existingPageUrl ?? ''].join('|'))
          .digest('hex').slice(0, 20),
      })),
    }
    const deck = buildBusinessGrowthMissionDeck(input)
    const saved = await repository.listWorkItems(ownerUserId, venture.id)
    const existingIds = new Set(saved.map(item => item.id))
    const fresh = deck.workItems.filter(item => !existingIds.has(item.id))
    if (fresh.length) await repository.upsertWorkItems(ownerUserId, fresh, { insertOnly: true })
    return NextResponse.json({
      ok: true,
      ventureId: venture.id,
      queued: fresh.filter(item => item.status === 'queued').length,
      blocked: fresh.filter(item => item.status === 'blocked').length,
      alreadyPresent: deck.workItems.length - fresh.length,
      authorizationEffect: 'NONE',
      evidenceStatus: 'UNVERIFIED_BROWSER_INPUT',
      externalExecutionAuthorized: false,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'MISSION_COMMIT_FAILED',
    }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }
}
