import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * SHARK wallet intelligence is intentionally fail-closed while its provider
 * package is absent from this workspace. No observation or trading capability
 * is silently substituted.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'shark_intelligence_unavailable', reason: 'SHARK provider package is not deployed in this workspace' },
    { status: 503 },
  )
}
