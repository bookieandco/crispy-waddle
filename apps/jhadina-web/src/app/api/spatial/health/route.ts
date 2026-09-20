import { NextResponse } from 'next/server'
import { checkSpatialProductionHealth } from '@/lib/context/spatial-production-health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await checkSpatialProductionHealth()
  return NextResponse.json(health, {
    status: health.status === 'READY' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
