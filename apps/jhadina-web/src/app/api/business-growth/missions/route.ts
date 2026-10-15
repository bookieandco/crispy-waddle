import { NextResponse } from 'next/server'
import { buildBusinessGrowthMissionDeck, type BusinessGrowthSnapshot } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Authenticated, read-only mission preview.
 * Browser-provided evidence is ALWAYS unverified: only future server-side
 * Search Console/Analytics/Commerce adapters may attach verified observations.
 */
export async function POST(request: Request) {
  try {
    await requireRequestIdentity()
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > 65_536) {
      return NextResponse.json({ ok: false, error: 'MISSION_PREVIEW_TOO_LARGE' }, { status: 413 })
    }
    const supplied = await request.json() as BusinessGrowthSnapshot
    if (!supplied || !Array.isArray(supplied.evidence) || !Array.isArray(supplied.signals)
      || supplied.signals.length > 25 || supplied.evidence.length > 50) {
      return NextResponse.json({ ok: false, error: 'MISSION_PREVIEW_INPUT_INVALID' }, { status: 400 })
    }
    const input: BusinessGrowthSnapshot = {
      ...supplied,
      evidence: supplied.evidence.map(item => ({ ...item, verified: false, kind: 'manual' })),
    }
    const deck = buildBusinessGrowthMissionDeck(input)
    return NextResponse.json({
      ok: true,
      data: deck,
      evidenceStatus: 'UNVERIFIED_BROWSER_INPUT',
      persistence: 'NONE',
      externalExecutionAuthorized: false,
      notes: 'This preview never queues live work, writes CRM rows, publishes, replies, or spends.',
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MISSION_PREVIEW_FAILED'
    if (/AUTH|SESSION|UNAUTHORIZED|LOGIN/i.test(message)) {
      return NextResponse.json({ ok: false, error: 'AUTHENTICATION_REQUIRED' }, { status: 401 })
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
