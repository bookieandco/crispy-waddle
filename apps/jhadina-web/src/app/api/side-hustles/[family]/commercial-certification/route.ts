import { NextResponse } from 'next/server'
import { isSideHustleFamily } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { certifySideHustleCommercialFamilyRuntime } from '@/lib/opportunities/side-hustle-commercial-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  return 400
}

export async function POST(
  _request: Request,
  context: { params: { family: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const family = context.params.family
    if (!isSideHustleFamily(family)) {
      return NextResponse.json(
        { ok: false, requestId, error: 'SIDE_HUSTLE_FAMILY_NOT_FOUND' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    const result = await certifySideHustleCommercialFamilyRuntime({
      family,
      certifiedAt: new Date().toISOString(),
    }, createSupabaseOpportunityRepository())

    return NextResponse.json({
      ok: true,
      requestId,
      ...result,
      externalActionAuthorized: false,
      moneyMovementAuthorized: false,
      automaticMaturityPromotionAuthorized: false,
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'side_hustle_commercial_certification_failed'
    return NextResponse.json(
      { ok: false, requestId, error: message },
      { status: statusFor(message), headers: { 'cache-control': 'no-store' } },
    )
  }
}
