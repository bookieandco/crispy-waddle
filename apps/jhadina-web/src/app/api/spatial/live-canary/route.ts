import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { runGevLiveEvidenceCanary } from '@/lib/context/gev-live-evidence-canary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store, max-age=0' }
const CONFIRM = 'RUN_ONE_AUTHORIZED_USGS_CANARY'

/**
 * No scheduler, GET execution or anonymous bypass. Manual owner-invoked
 * receipt only; production flag + privileged OIDC + fresh upstream all required.
 */
export async function POST(req: NextRequest) {
  const claimed = req.headers.get('x-jhadina-user-id')?.trim()
  if (!claimed) return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  try {
    const user = await (await createRequestIdentityVerifier()).verify({ userId: claimed })
    if (!user.userId || user.userId !== claimed) throw new Error('IDENTITY_MISMATCH')
  } catch {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  }

  let confirm: unknown
  try {
    const body = await req.text()
    if (new TextEncoder().encode(body).byteLength > 256) throw new Error('BODY_TOO_LARGE')
    const parsed = JSON.parse(body) as unknown
    confirm = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { confirm?: unknown }).confirm : undefined
  } catch {
    return NextResponse.json({ success: false, error: 'GEV_CANARY_REQUEST_INVALID' }, { status: 400, headers })
  }
  if (confirm !== CONFIRM) return NextResponse.json({
    success: false, error: 'EXPLICIT_CANARY_CONFIRMATION_REQUIRED',
  }, { status: 400, headers })

  // The service independently checks VERCEL_ENV and a dedicated owner-controlled
  // feature flag; the route cannot enable writing through request fields.
  const receipt = await runGevLiveEvidenceCanary()
  return NextResponse.json({
    success: receipt.status === 'VERIFIED',
    data: receipt,
  }, { status: receipt.status === 'VERIFIED' ? 200 : 503, headers })
}
