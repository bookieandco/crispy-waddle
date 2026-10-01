import { NextRequest, NextResponse } from 'next/server'
import {
  buildVentureOpportunity,
  type SideHustleAutomationMaturity,
  type SideHustleFamily,
  type VentureDemandThesis,
  type VentureMakeSenseVote,
  type VentureOriginalityInput,
  type VentureScoreFactors,
  type VentureUnitEconomics,
} from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CreateVentureBody = {
  opportunityId?: string
  family?: SideHustleFamily
  signalIds?: string[]
  demandThesis?: VentureDemandThesis
  unitEconomics?: Partial<VentureUnitEconomics>
  scoreFactors?: VentureScoreFactors
  makeSense?: Omit<VentureMakeSenseVote, 'overall' | 'decision'>
  originalityInput?: VentureOriginalityInput
  automationMaturity?: SideHustleAutomationMaturity
  evidenceRefs?: string[]
}

function isAuthError(message: string): boolean {
  return /Authenticated|identity|session/i.test(message)
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ ok: false, requestId, error: 'venture_runtime_unavailable' }, { status: 503 })

    const repository = new VentureRuntimeRepository(service)
    const ventures = await repository.listVentures(identity.userId)
    const includeScout = request.nextUrl.searchParams.get('includeScout') === 'true'
    const scoutSignals = includeScout
      ? await repository.listScoutSignals({ limit: 100 })
      : []

    return NextResponse.json({
      ok: true,
      requestId,
      ventures,
      scoutSignals,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_list_failed'
    return NextResponse.json(
      { ok: false, requestId, error: isAuthError(message) ? 'Authentication required' : message },
      { status: isAuthError(message) ? 401 : 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const identity = await requireRequestIdentity()
    const body = await request.json().catch(() => ({})) as CreateVentureBody
    const opportunityId = body.opportunityId?.trim() ?? ''
    if (!opportunityId) return NextResponse.json({ ok: false, requestId, error: 'opportunityId is required' }, { status: 400 })
    if (!body.family || !body.demandThesis || !body.scoreFactors || !body.makeSense || !body.originalityInput) {
      return NextResponse.json({ ok: false, requestId, error: 'venture thesis, score, Make It Make Sense vote, and originality input are required' }, { status: 400 })
    }
    const signalIds = [...new Set((body.signalIds ?? []).map((id) => id.trim()).filter(Boolean))]
    if (!signalIds.length) return NextResponse.json({ ok: false, requestId, error: 'At least one persisted scout signal is required' }, { status: 400 })

    const canonical = await createSupabaseOpportunityRepository().get(opportunityId)
    if (!canonical) return NextResponse.json({ ok: false, requestId, error: 'Opportunity not found' }, { status: 404 })

    const service = createServiceRoleClient()
    if (!service) return NextResponse.json({ ok: false, requestId, error: 'venture_runtime_unavailable' }, { status: 503 })
    const repository = new VentureRuntimeRepository(service)
    const selected = await repository.getScoutSignals(signalIds)
    if (selected.length !== signalIds.length) {
      return NextResponse.json({ ok: false, requestId, error: 'One or more scout signals were not found or are inactive' }, { status: 409 })
    }
    if (selected.some((record) => record.family !== body.family)) {
      return NextResponse.json({ ok: false, requestId, error: 'Selected scout signals do not match the requested venture family' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const evidenceRefs = [...new Set([
      ...(body.evidenceRefs ?? []),
      ...selected.map((record) => record.signal.sourceRef),
    ])]

    const venture = buildVentureOpportunity({
      opportunity: canonical.opportunity,
      family: body.family,
      demandThesis: body.demandThesis,
      signals: selected.map((record) => record.signal),
      unitEconomics: body.unitEconomics,
      scoreFactors: body.scoreFactors,
      makeSense: body.makeSense,
      originalityInput: body.originalityInput,
      automationMaturity: body.automationMaturity,
      evidenceRefs,
      createdAt: now,
    })

    await repository.saveVenture(identity.userId, venture)
    return NextResponse.json({
      ok: true,
      requestId,
      venture,
      externalActionAuthorized: false,
      directCreativeReplicationAuthorized: false,
      moneyMovementAuthorized: false,
    }, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'venture_create_failed'
    return NextResponse.json(
      { ok: false, requestId, error: isAuthError(message) ? 'Authentication required' : message },
      { status: isAuthError(message) ? 401 : 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
