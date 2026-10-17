import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { currentGevLiveCloseoutPreflight } from '@/lib/context/gev-live-closeout'
import { getGevCertBlockedPreflight } from '@/lib/context/gev-cert-acceptance'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store, max-age=0' }

/** Owner-only, read-only preflight. Never creates a certification or dispatches a canary. */
export async function GET(req: NextRequest) {
  const claimed = req.headers.get('x-jhadina-user-id')?.trim()
  if (!claimed) return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  try {
    const verified = await (await createRequestIdentityVerifier()).verify({ userId: claimed })
    if (!verified.userId || verified.userId !== claimed) throw new Error('IDENTITY_MISMATCH')
  } catch {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  }
  const report = currentGevLiveCloseoutPreflight()
  return NextResponse.json({ success: true, data: report, certStages: getGevCertBlockedPreflight() }, { status: 200, headers })
}
