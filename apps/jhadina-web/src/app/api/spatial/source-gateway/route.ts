import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { parseGatewayInput, readGevLiveSourceGateway } from '@/lib/context/gev-live-source-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const responseHeaders = { 'Cache-Control': 'no-store, max-age=0' }
const MAX_BODY_BYTES = 2_048

/** Authenticated, read-only canonical gateway. NOT an anonymous GEV relay. */
export async function POST(req: NextRequest) {
  const claimedUser = req.headers.get('x-jhadina-user-id')?.trim()
  if (!claimedUser) {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers: responseHeaders })
  }
  try {
    const verified = await (await createRequestIdentityVerifier()).verify({ userId: claimedUser })
    if (!verified.userId) throw new Error('AUTH_REQUIRED')
  } catch {
    return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401, headers: responseHeaders })
  }

  let input
  try {
    const body = await req.text()
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
    input = parseGatewayInput(JSON.parse(body) as unknown)
  } catch {
    return NextResponse.json({ success: false, error: 'GEV_GATEWAY_REQUEST_INVALID' }, { status: 400, headers: responseHeaders })
  }

  try {
    const snapshot = await readGevLiveSourceGateway(input)
    return NextResponse.json({ success: true, data: snapshot }, { status: 200, headers: responseHeaders })
  } catch {
    return NextResponse.json({ success: false, error: 'GEV_GATEWAY_UNAVAILABLE' }, { status: 503, headers: responseHeaders })
  }
}
