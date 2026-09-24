import { NextResponse } from 'next/server'
import { createPublicSatelliteSpatialProvider } from '@jhadina/spatial-intelligence-core'

export const dynamic = 'force-dynamic'

export async function GET() {
  const provider = createPublicSatelliteSpatialProvider({ timeoutMs: 8_000 })
  const health = await provider.health('private-analysis')
  return NextResponse.json(health, {
    status: health.status === 'READY' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
