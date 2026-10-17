import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { readGevPublicReadiness } from '@/lib/context/gev-cert-public-readiness'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store, max-age=0' }

/** Owner-only GET, fixed provider endpoints, no persistence or writes.
 * A SOURCE_READABLE response is not a production/canary certificate. */
export async function GET(req: NextRequest) {
  const claimed = req.headers.get('x-jhadina-user-id')?.trim()
  if (!claimed) return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimed })
    if (identity.userId !== claimed) throw new Error('IDENTITY_MISMATCH')
  } catch {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers })
  }
  try {
    const report = await readGevPublicReadiness()
    return NextResponse.json({ success: true, data: report }, { status: 200, headers })
  } catch {
    return NextResponse.json({ success: false, error: 'PUBLIC_SOURCE_PROBE_UNAVAILABLE' }, { status: 503, headers })
  }
}
